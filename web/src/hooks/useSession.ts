import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import {
	createSession,
	deleteSession,
	updateSessionTitle,
} from "../lib/sessionApi";
import { setSessionExistsChecker, useWSStore } from "../lib/wsStore";
import type {
	SessionListChangedNotification,
	SessionMeta,
} from "../types/message";

interface SessionState {
	sessions: SessionMeta[];
	isLoading: boolean;
	isSuccess: boolean;
}

interface SessionStore extends SessionState {
	setSessions: (sessions: SessionMeta[]) => void;
	updateSessions: (updater: (old: SessionMeta[]) => SessionMeta[]) => void;
	reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
	sessions: [],
	isLoading: true,
	isSuccess: false,
	setSessions: (sessions) =>
		set({ sessions, isLoading: false, isSuccess: true }),
	updateSessions: (updater) =>
		set((state) => ({ sessions: updater(state.sessions) })),
	reset: () => set({ sessions: [], isLoading: false, isSuccess: false }),
}));

interface UseSessionOptions {
	enabled?: boolean;
	/** Session ID from URL */
	routeSessionId?: string | null;
}

export function useSession({
	enabled = true,
	routeSessionId,
}: UseSessionOptions = {}) {
	const wsStatus = useWSStore((s) => s.status);
	const sessionListSubscribe = useWSStore(
		(s) => s.actions.sessionListSubscribe,
	);
	const sessionListUnsubscribe = useWSStore(
		(s) => s.actions.sessionListUnsubscribe,
	);

	const { sessions, isLoading, isSuccess, setSessions, updateSessions, reset } =
		useSessionStore();

	const isConnected = wsStatus === "connected";
	const watchIdRef = useRef<string | null>(null);

	// Manage subscription lifecycle
	useEffect(() => {
		if (!enabled || !isConnected) {
			reset();
			return;
		}

		let cancelled = false;

		async function setupSubscription() {
			if (watchIdRef.current) {
				await sessionListUnsubscribe(watchIdRef.current);
				watchIdRef.current = null;
			}

			if (cancelled) return;

			try {
				const result = await sessionListSubscribe(
					(params: SessionListChangedNotification) => {
						updateSessions((old) => {
							switch (params.operation) {
								case "create":
									return [
										params.session,
										...old.filter((s) => s.id !== params.session.id),
									];
								case "update":
									return old.map((s) =>
										s.id === params.session.id ? params.session : s,
									);
								case "delete":
									return old.filter((s) => s.id !== params.sessionId);
							}
						});
					},
				);

				if (cancelled) {
					await sessionListUnsubscribe(result.id);
					return;
				}

				watchIdRef.current = result.id;
				setSessions(result.sessions);
			} catch (error) {
				console.error("Failed to subscribe to session list:", error);
				if (!cancelled) {
					reset();
				}
			}
		}

		setupSubscription();

		return () => {
			cancelled = true;
			if (watchIdRef.current) {
				sessionListUnsubscribe(watchIdRef.current);
				watchIdRef.current = null;
			}
		};
	}, [
		enabled,
		isConnected,
		sessionListSubscribe,
		sessionListUnsubscribe,
		setSessions,
		updateSessions,
		reset,
	]);

	// Register session existence checker for wsStore
	useEffect(() => {
		setSessionExistsChecker((sessionId) =>
			sessions.some((s) => s.id === sessionId),
		);
		return () => setSessionExistsChecker(null);
	}, [sessions]);

	const createMutation = useMutation({
		mutationFn: createSession,
	});

	const deleteMutation = useMutation({
		mutationFn: deleteSession,
	});

	const updateTitleMutation = useMutation({
		mutationFn: ({ id, title }: { id: string; title: string }) =>
			updateSessionTitle(id, title),
	});

	const currentSessionId = routeSessionId ?? null;
	const currentSession = sessions.find((s) => s.id === currentSessionId);

	const redirectSessionId = (() => {
		if (!isSuccess) return null;
		if (currentSessionId && currentSession) return null;
		if (sessions.length > 0) return sessions[0].id;
		return null;
	})();

	const needsNewSession = isSuccess && sessions.length === 0;

	return {
		sessions,
		currentSessionId,
		currentSession,
		isLoading,
		isSuccess,
		redirectSessionId,
		needsNewSession,
		createSession: () => createMutation.mutateAsync(),
		deleteSession: (id: string) => deleteMutation.mutateAsync(id),
		updateTitle: (id: string, title: string) =>
			updateTitleMutation.mutate({ id, title }),
	};
}
