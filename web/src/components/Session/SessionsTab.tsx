import { Plus } from "lucide-react";
import { useSession } from "../../hooks/useSession";
import { useSidebarRefresh } from "../Layout";
import { PullToRefresh } from "../ui";
import SessionList from "./SessionList";

interface Props {
	currentSessionId: string | null;
	onSelectSession: (id: string) => void;
	onCreateSession: () => void;
	onDeleteSession: (id: string) => void;
}

function SessionsTab({
	currentSessionId,
	onSelectSession,
	onCreateSession,
	onDeleteSession,
}: Props) {
	const { sessions, isLoading, refresh } = useSession();
	const { isActive } = useSidebarRefresh("sessions", refresh);

	return (
		<div
			className={isActive ? "flex flex-1 flex-col overflow-hidden" : "hidden"}
		>
			<div className="p-2">
				<button
					type="button"
					onClick={onCreateSession}
					className="flex w-full items-center justify-center gap-2 rounded-lg bg-th-accent p-3 font-medium text-th-accent-text hover:bg-th-accent-hover"
				>
					<Plus className="h-5 w-5" aria-hidden="true" />
					New Chat
				</button>
			</div>
			<PullToRefresh onRefresh={refresh}>
				{isLoading ? (
					<div className="p-4 text-center text-th-text-muted">Loading...</div>
				) : (
					<SessionList
						sessions={sessions}
						currentSessionId={currentSessionId}
						onSelectSession={onSelectSession}
						onDeleteSession={onDeleteSession}
					/>
				)}
			</PullToRefresh>
		</div>
	);
}

export default SessionsTab;
