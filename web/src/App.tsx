import { useCallback, useEffect, useState } from "react";
import TokenInput from "./components/Auth/TokenInput";
import { ChatPanel } from "./components/Chat";
import { SessionSidebar } from "./components/Session";
import { useSession } from "./hooks/useSession";
import { AuthError } from "./lib/sessionApi";
import { wsStore } from "./lib/wsStore";
import { clearToken, getToken, saveToken } from "./utils/config";

function App() {
	const [hasToken, setHasToken] = useState(() => !!getToken());
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const {
		sessions,
		currentSessionId,
		currentSession,
		isLoading,
		error,
		loadSessions,
		createSession,
		selectSession,
		deleteSession,
		updateTitle,
	} = useSession({ enabled: hasToken });

	const handleTokenSubmit = (token: string) => {
		saveToken(token);
		setHasToken(true);
	};

	const handleLogout = useCallback(() => {
		wsStore.disconnect();
		clearToken();
		setHasToken(false);
	}, []);

	// Auto logout on auth error
	useEffect(() => {
		if (error instanceof AuthError) {
			handleLogout();
		}
	}, [error, handleLogout]);

	const handleOpenSidebar = useCallback(() => {
		setSidebarOpen(true);
		loadSessions();
	}, [loadSessions]);

	const handleCreateSession = useCallback(async () => {
		await createSession();
		setSidebarOpen(false);
	}, [createSession]);

	if (!hasToken) {
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
				onLogout={handleLogout}
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
