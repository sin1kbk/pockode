import { useCallback, useState } from "react";
import TokenInput from "./components/Auth/TokenInput";
import { ChatPanel } from "./components/Chat";
import { SessionSidebar } from "./components/Session";
import { useSession } from "./hooks/useSession";
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

	const handleLogout = () => {
		wsStore.disconnect();
		clearToken();
		setHasToken(false);
	};

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
			<div className="flex h-screen items-center justify-center bg-gray-900">
				<div className="text-gray-400">Loading...</div>
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
