package watch

// Watcher defines the common lifecycle interface for all watchers.
// Subscribe is intentionally not included as each watcher has different
// parameter and return types based on what it monitors.
type Watcher interface {
	Start() error
	Stop()
	CleanupConnection(connID string)
}

var (
	_ Watcher = (*FSWatcher)(nil)
	_ Watcher = (*GitWatcher)(nil)
	_ Watcher = (*WorktreeWatcher)(nil)
	_ Watcher = (*SessionListWatcher)(nil)
)
