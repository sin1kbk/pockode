import { useCallback, useEffect, useState } from "react";
import { createSession, deleteSession, listSessions } from "../lib/sessionApi";
import type { SessionMeta } from "../types/message";

interface UseSessionOptions {
	enabled?: boolean;
}

export function useSession({ enabled = true }: UseSessionOptions = {}) {
	const [sessions, setSessions] = useState<SessionMeta[]>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Load existing sessions or create new one on mount
	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;
		const init = async () => {
			try {
				const existing = await listSessions();
				if (cancelled) return;

				if (existing.length > 0) {
					setSessions(existing);
					setCurrentSessionId(existing[0].id);
				} else {
					const sess = await createSession();
					if (cancelled) return;
					setSessions([sess]);
					setCurrentSessionId(sess.id);
				}
			} catch (err) {
				console.error("Failed to initialize session:", err);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};
		init();

		return () => {
			cancelled = true;
		};
	}, [enabled]);

	const loadSessions = useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await listSessions();
			setSessions(data);
		} catch (err) {
			console.error("Failed to load sessions:", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const handleCreate = useCallback(async () => {
		try {
			const sess = await createSession();
			setCurrentSessionId(sess.id);
			setSessions((prev) => [sess, ...prev]);
			return sess;
		} catch (err) {
			console.error("Failed to create session:", err);
			return null;
		}
	}, []);

	const handleSelect = useCallback((id: string) => {
		setCurrentSessionId(id);
	}, []);

	const handleDelete = useCallback(
		async (id: string) => {
			try {
				await deleteSession(id);

				const remaining = sessions.filter((s) => s.id !== id);

				if (id === currentSessionId) {
					if (remaining.length > 0) {
						setSessions(remaining);
						setCurrentSessionId(remaining[0].id);
					} else {
						// Create new session before updating state to avoid broken state
						const newSess = await createSession();
						setSessions([newSess]);
						setCurrentSessionId(newSess.id);
					}
				} else {
					setSessions(remaining);
				}
			} catch (err) {
				console.error("Failed to delete session:", err);
			}
		},
		[sessions, currentSessionId],
	);

	return {
		sessions,
		currentSessionId,
		isLoading,
		loadSessions,
		createSession: handleCreate,
		selectSession: handleSelect,
		deleteSession: handleDelete,
	};
}
