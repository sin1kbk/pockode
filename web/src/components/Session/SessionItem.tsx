import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useHasUnread } from "../../lib/unreadStore";
import type { SessionMeta } from "../../types/message";
import ConfirmDialog from "../common/ConfirmDialog";
import SidebarListItem from "../common/SidebarListItem";

interface Props {
	session: SessionMeta;
	isActive: boolean;
	onSelect: () => void;
	onDelete: () => void;
}

function SessionItem({ session, isActive, onSelect, onDelete }: Props) {
	const hasUnread = useHasUnread(session.id);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	return (
		<>
			<SidebarListItem
				title={session.title}
				subtitle={new Date(session.created_at).toLocaleDateString()}
				isActive={isActive}
				hasChanges={hasUnread}
				onSelect={onSelect}
				actions={
					<button
						type="button"
						onClick={() => setShowDeleteConfirm(true)}
						className="rounded p-1 text-th-text-muted transition-opacity hover:bg-th-bg-secondary hover:text-th-text-primary sm:opacity-0 sm:group-hover:opacity-100"
						aria-label="Delete session"
					>
						<Trash2 className="h-4 w-4" aria-hidden="true" />
					</button>
				}
			/>

			{showDeleteConfirm && (
				<ConfirmDialog
					title="Delete Session"
					message={`Are you sure you want to delete "${session.title}"? This action cannot be undone.`}
					confirmLabel="Delete"
					cancelLabel="Cancel"
					variant="danger"
					onConfirm={() => {
						setShowDeleteConfirm(false);
						onDelete();
					}}
					onCancel={() => setShowDeleteConfirm(false)}
				/>
			)}
		</>
	);
}

export default SessionItem;
