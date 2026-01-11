package watch

import (
	"context"
	"log/slog"
	"sync"

	"github.com/sourcegraph/jsonrpc2"
)

type Subscription struct {
	ID     string
	Path   string
	ConnID string
	Conn   *jsonrpc2.Conn
}

// BaseWatcher provides common subscription management for all watcher types.
type BaseWatcher struct {
	idPrefix string

	subMu         sync.RWMutex
	subscriptions map[string]*Subscription
	connToIDs     map[string][]string // connID -> subscription IDs

	ctx    context.Context
	cancel context.CancelFunc
}

func NewBaseWatcher(idPrefix string) *BaseWatcher {
	ctx, cancel := context.WithCancel(context.Background())
	return &BaseWatcher{
		idPrefix:      idPrefix,
		subscriptions: make(map[string]*Subscription),
		connToIDs:     make(map[string][]string),
		ctx:           ctx,
		cancel:        cancel,
	}
}

func (b *BaseWatcher) GenerateID() string {
	return generateIDWithPrefix(b.idPrefix)
}

func (b *BaseWatcher) AddSubscription(sub *Subscription) {
	b.subMu.Lock()
	defer b.subMu.Unlock()

	b.subscriptions[sub.ID] = sub
	b.connToIDs[sub.ConnID] = append(b.connToIDs[sub.ConnID], sub.ID)
}

func (b *BaseWatcher) RemoveSubscription(id string) *Subscription {
	b.subMu.Lock()
	defer b.subMu.Unlock()

	sub, ok := b.subscriptions[id]
	if !ok {
		return nil
	}

	delete(b.subscriptions, id)

	// Remove from connToIDs
	ids := b.connToIDs[sub.ConnID]
	for i, v := range ids {
		if v == id {
			b.connToIDs[sub.ConnID] = append(ids[:i], ids[i+1:]...)
			break
		}
	}
	if len(b.connToIDs[sub.ConnID]) == 0 {
		delete(b.connToIDs, sub.ConnID)
	}

	return sub
}

// CleanupConnection removes all subscriptions for a connection.
// Returns removed subscriptions for caller's additional cleanup (e.g., FSWatcher path mappings).
func (b *BaseWatcher) CleanupConnection(connID string) []*Subscription {
	b.subMu.Lock()
	defer b.subMu.Unlock()

	ids, ok := b.connToIDs[connID]
	if !ok {
		return nil
	}

	removed := make([]*Subscription, 0, len(ids))
	for _, id := range ids {
		if sub, exists := b.subscriptions[id]; exists {
			removed = append(removed, sub)
			delete(b.subscriptions, id)
		}
	}
	delete(b.connToIDs, connID)

	if len(removed) > 0 {
		slog.Debug("cleaned up connection subscriptions",
			"connId", connID,
			"count", len(removed))
	}

	return removed
}

func (b *BaseWatcher) GetAllSubscriptions() []*Subscription {
	b.subMu.RLock()
	defer b.subMu.RUnlock()

	subs := make([]*Subscription, 0, len(b.subscriptions))
	for _, sub := range b.subscriptions {
		subs = append(subs, sub)
	}
	return subs
}

func (b *BaseWatcher) NotifyAll(method string, makeParams func(sub *Subscription) any) {
	subs := b.GetAllSubscriptions()
	if len(subs) == 0 {
		return
	}

	for _, sub := range subs {
		params := makeParams(sub)
		if err := sub.Conn.Notify(context.Background(), method, params); err != nil {
			slog.Debug("failed to notify subscriber",
				"id", sub.ID,
				"error", err)
		}
	}
}

func (b *BaseWatcher) Context() context.Context { return b.ctx }
func (b *BaseWatcher) Cancel()                  { b.cancel() }

func (b *BaseWatcher) HasSubscriptions() bool {
	b.subMu.RLock()
	defer b.subMu.RUnlock()
	return len(b.subscriptions) > 0
}
