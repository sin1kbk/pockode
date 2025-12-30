import { useMatch, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../hooks/useSession";
import {
	authActions,
	selectIsAuthenticated,
	useAuthStore,
} from "../lib/authStore";
import type { DiffSearchParams } from "../router";
import type { OverlayState } from "../types/overlay";
import TokenInput from "./Auth/TokenInput";
import { ChatPanel } from "./Chat";
import { SessionSidebar } from "./Session";

interface RouteInfo {
	overlay: OverlayState;
	sessionId: string | null;
	isIndexRoute: boolean;
}

/**
 * Derives overlay and session state from the current route.
 */
function useRouteState(): RouteInfo {
	const indexMatch = useMatch({
		from: "/",
		shouldThrow: false,
	});
	const sessionMatch = useMatch({
		from: "/s/$sessionId",
		shouldThrow: false,
	});
	const stagedMatch = useMatch({
		from: "/staged/$",
		shouldThrow: false,
	});
	const unstagedMatch = useMatch({
		from: "/unstaged/$",
		shouldThrow: false,
	});

	if (sessionMatch) {
		return {
			overlay: null,
			sessionId: sessionMatch.params.sessionId,
			isIndexRoute: false,
		};
	}

	if (stagedMatch) {
		const search = stagedMatch.search as DiffSearchParams;
		return {
			overlay: {
				type: "diff",
				path: stagedMatch.params._splat ?? "",
				staged: true,
			},
			sessionId: search.session ?? null,
			isIndexRoute: false,
		};
	}

	if (unstagedMatch) {
		const search = unstagedMatch.search as DiffSearchParams;
		return {
			overlay: {
				type: "diff",
				path: unstagedMatch.params._splat ?? "",
				staged: false,
			},
			sessionId: search.session ?? null,
			isIndexRoute: false,
		};
	}

	return {
		overlay: null,
		sessionId: null,
		isIndexRoute: !!indexMatch,
	};
}

function AppShell() {
	const isAuthenticated = useAuthStore(selectIsAuthenticated);
	const navigate = useNavigate();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const { overlay, sessionId: routeSessionId, isIndexRoute } = useRouteState();

	const {
		sessions,
		currentSessionId,
		currentSession,
		isLoading,
		loadSessions,
		createSession,
		deleteSession,
		updateTitle,
	} = useSession({ enabled: isAuthenticated, routeSessionId });

	// Redirect from index route to session route (replace to keep / out of history)
	useEffect(() => {
		if (isIndexRoute && currentSessionId) {
			navigate({
				to: "/s/$sessionId",
				params: { sessionId: currentSessionId },
				replace: true,
			});
		}
	}, [isIndexRoute, currentSessionId, navigate]);

	const handleTokenSubmit = (token: string) => {
		authActions.login(token);
	};

	const handleOpenSidebar = useCallback(() => {
		setSidebarOpen(true);
		loadSessions();
	}, [loadSessions]);

	const handleSelectSession = useCallback(
		(id: string) => {
			// routeSessionId will be set by the router, no need to call selectSession
			navigate({ to: "/s/$sessionId", params: { sessionId: id } });
			setSidebarOpen(false);
		},
		[navigate],
	);

	const handleCreateSession = useCallback(async () => {
		const newSession = await createSession();
		setSidebarOpen(false);
		if (newSession) {
			navigate({ to: "/s/$sessionId", params: { sessionId: newSession.id } });
		}
	}, [createSession, navigate]);

	const handleSelectDiffFile = useCallback(
		(path: string, staged: boolean) => {
			const route = staged ? "/staged/$" : "/unstaged/$";
			navigate({
				to: route,
				params: { _splat: path },
				search: currentSessionId ? { session: currentSessionId } : {},
			});
		},
		[navigate, currentSessionId],
	);

	const handleCloseOverlay = useCallback(() => {
		if (currentSessionId) {
			navigate({
				to: "/s/$sessionId",
				params: { sessionId: currentSessionId },
			});
		} else {
			navigate({ to: "/" });
		}
	}, [navigate, currentSessionId]);

	if (!isAuthenticated) {
		return <TokenInput onSubmit={handleTokenSubmit} />;
	}

	if (!currentSessionId || !currentSession) {
		return (
			<div className="flex h-dvh items-center justify-center bg-th-bg-primary">
				<div className="text-th-text-muted">Loading...</div>
			</div>
		);
	}

	return (
		<>
			<ChatPanel
				sessionId={currentSessionId}
				sessionTitle={currentSession.title}
				onUpdateTitle={(title) => updateTitle(currentSessionId, title)}
				onLogout={authActions.logout}
				onOpenSidebar={handleOpenSidebar}
				overlay={overlay}
				onCloseOverlay={handleCloseOverlay}
			/>
			<SessionSidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				sessions={sessions}
				currentSessionId={currentSessionId}
				onSelectSession={handleSelectSession}
				onCreateSession={handleCreateSession}
				onDeleteSession={deleteSession}
				onSelectDiffFile={handleSelectDiffFile}
				isLoading={isLoading}
			/>
		</>
	);
}

export default AppShell;
