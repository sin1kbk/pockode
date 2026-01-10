package watch

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/sourcegraph/jsonrpc2"
)

const debounceInterval = 100 * time.Millisecond

// Subscription represents a single watch subscription.
type Subscription struct {
	ID     string
	Path   string
	ConnID string
	Conn   *jsonrpc2.Conn
}

// FSWatcher watches filesystem changes and notifies subscribers.
type FSWatcher struct {
	workDir string
	watcher *fsnotify.Watcher

	subMu         sync.RWMutex
	subscriptions map[string]*Subscription
	pathToIDs     map[string][]string
	pathRefCount  map[string]int

	timerMu  sync.Mutex
	timerMap map[string]*time.Timer

	ctx    context.Context
	cancel context.CancelFunc
}

// NewFSWatcher creates a new FSWatcher.
func NewFSWatcher(workDir string) *FSWatcher {
	ctx, cancel := context.WithCancel(context.Background())
	return &FSWatcher{
		workDir:       workDir,
		subscriptions: make(map[string]*Subscription),
		pathToIDs:     make(map[string][]string),
		pathRefCount:  make(map[string]int),
		timerMap:      make(map[string]*time.Timer),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Start begins watching for filesystem events.
func (w *FSWatcher) Start() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	w.watcher = watcher

	go w.eventLoop()
	slog.Info("FSWatcher started", "workDir", w.workDir)
	return nil
}

// Stop stops the watcher and cleans up resources.
func (w *FSWatcher) Stop() {
	w.cancel()
	if w.watcher != nil {
		w.watcher.Close()
	}

	// Cancel any pending debounce timers
	w.timerMu.Lock()
	for _, timer := range w.timerMap {
		timer.Stop()
	}
	w.timerMap = make(map[string]*time.Timer)
	w.timerMu.Unlock()

	slog.Info("FSWatcher stopped")
}

// Subscribe adds a watch subscription and returns a unique watch ID.
func (w *FSWatcher) Subscribe(path string, conn *jsonrpc2.Conn, connID string) (string, error) {
	id := GenerateID()

	w.subMu.Lock()
	defer w.subMu.Unlock()

	// Validate path exists
	fullPath := filepath.Join(w.workDir, path)
	if _, err := os.Stat(fullPath); err != nil {
		return "", err
	}

	// Start fsnotify watch if first subscriber for this path
	if w.pathRefCount[path] == 0 {
		if err := w.watcher.Add(fullPath); err != nil {
			return "", err
		}
		slog.Debug("started watching path", "path", path)
	}

	// Add subscription
	sub := &Subscription{ID: id, Path: path, ConnID: connID, Conn: conn}
	w.subscriptions[id] = sub
	w.pathToIDs[path] = append(w.pathToIDs[path], id)
	w.pathRefCount[path]++

	slog.Debug("subscription added", "watchId", id, "path", path, "connId", connID)
	return id, nil
}

// Unsubscribe removes a subscription by watch ID.
func (w *FSWatcher) Unsubscribe(id string) {
	w.subMu.Lock()
	defer w.subMu.Unlock()

	sub, ok := w.subscriptions[id]
	if !ok {
		return
	}
	w.removeSubLocked(id, sub)
}

// CleanupConnection removes all subscriptions for a connection.
func (w *FSWatcher) CleanupConnection(connID string) {
	w.subMu.Lock()
	defer w.subMu.Unlock()

	// Collect IDs to remove first to avoid modifying map during iteration
	var toRemove []string
	for id, sub := range w.subscriptions {
		if sub.ConnID == connID {
			toRemove = append(toRemove, id)
		}
	}

	for _, id := range toRemove {
		if sub, ok := w.subscriptions[id]; ok {
			w.removeSubLocked(id, sub)
		}
	}

	if len(toRemove) > 0 {
		slog.Debug("cleaned up connection subscriptions", "connId", connID, "count", len(toRemove))
	}
}

// removeSubLocked removes a subscription. Must be called with subMu held.
func (w *FSWatcher) removeSubLocked(id string, sub *Subscription) {
	delete(w.subscriptions, id)

	// Remove from pathToIDs
	ids := w.pathToIDs[sub.Path]
	for i, v := range ids {
		if v == id {
			w.pathToIDs[sub.Path] = append(ids[:i], ids[i+1:]...)
			break
		}
	}
	if len(w.pathToIDs[sub.Path]) == 0 {
		delete(w.pathToIDs, sub.Path)
	}

	// Decrement ref count, remove fsnotify watch if last
	w.pathRefCount[sub.Path]--
	if w.pathRefCount[sub.Path] == 0 {
		fullPath := filepath.Join(w.workDir, sub.Path)
		w.watcher.Remove(fullPath)
		delete(w.pathRefCount, sub.Path)
		slog.Debug("stopped watching path", "path", sub.Path)
	}

	slog.Debug("subscription removed", "watchId", id, "path", sub.Path)
}

func (w *FSWatcher) eventLoop() {
	for {
		select {
		case <-w.ctx.Done():
			return
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			w.handleEvent(event)
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			slog.Error("fsnotify error", "error", err)
		}
	}
}

func (w *FSWatcher) handleEvent(event fsnotify.Event) {
	// Ignore CHMOD events - they're triggered by atime updates (e.g., git status reading files)
	// and don't represent actual content changes
	if event.Op == fsnotify.Chmod {
		return
	}

	relPath, err := filepath.Rel(w.workDir, event.Name)
	if err != nil {
		slog.Error("failed to get relative path", "path", event.Name, "error", err)
		return
	}

	// Debounce per path
	w.timerMu.Lock()
	if timer, exists := w.timerMap[relPath]; exists {
		timer.Stop()
	}
	w.timerMap[relPath] = time.AfterFunc(debounceInterval, func() {
		w.notifyPath(relPath)
		w.timerMu.Lock()
		delete(w.timerMap, relPath)
		w.timerMu.Unlock()
	})
	w.timerMu.Unlock()
}

func (w *FSWatcher) notifyPath(path string) {
	w.subMu.RLock()
	subs := make([]*Subscription, 0, len(w.pathToIDs[path]))
	for _, id := range w.pathToIDs[path] {
		if sub := w.subscriptions[id]; sub != nil {
			subs = append(subs, sub)
		}
	}
	w.subMu.RUnlock()

	if len(subs) == 0 {
		return
	}

	for _, sub := range subs {
		err := sub.Conn.Notify(context.Background(), "watch.changed", map[string]any{
			"id": sub.ID,
		})
		if err != nil {
			slog.Debug("failed to notify subscriber", "watchId", sub.ID, "error", err)
		}
	}

	slog.Debug("notified path change", "path", path, "subscribers", len(subs))
}

