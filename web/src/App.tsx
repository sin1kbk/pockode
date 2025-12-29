import { useCallback, useState } from "react";
import TokenInput from "./components/Auth/TokenInput";
import { ChatPanel } from "./components/Chat";
import { SessionSidebar } from "./components/Session";
import { useSession } from "./hooks/useSession";
import {
	authActions,
	selectIsAuthenticated,
	useAuthStore,
} from "./lib/authStore";

function App() {
	const isAuthenticated = useAuthStore(selectIsAuthenticated);
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const {
		sessions,
		currentSessionId,
		currentSession,
		isLoading,
		loadSessions,
		createSession,
		selectSession,
		deleteSession,
		updateTitle,
	} = useSession({ enabled: isAuthenticated });

	const handleTokenSubmit = (token: string) => {
		authActions.login(token);
	};

	const handleOpenSidebar = useCallback(() => {
		setSidebarOpen(true);
		loadSessions();
	}, [loadSessions]);

	const handleCreateSession = useCallback(async () => {
		await createSession();
		setSidebarOpen(false);
	}, [createSession]);

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
			/>
			<SessionSidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				sessions={sessions}
				currentSessionId={currentSessionId}
				onSelectSession={selectSession}
				onCreateSession={handleCreateSession}
				onDeleteSession={deleteSession}
				isLoading={isLoading}
			/>
		</>
	);
}

export default App;
