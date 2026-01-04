import { useSession } from "../../hooks/useSession";
import { useSidebarRefresh } from "../Layout";
import { PullToRefresh } from "../ui";
import SessionSidebarContent from "./SessionSidebarContent";

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
			<PullToRefresh onRefresh={refresh}>
				<SessionSidebarContent
					sessions={sessions}
					currentSessionId={currentSessionId}
					onSelectSession={onSelectSession}
					onCreateSession={onCreateSession}
					onDeleteSession={onDeleteSession}
					isLoading={isLoading}
				/>
			</PullToRefresh>
		</div>
	);
}

export default SessionsTab;
