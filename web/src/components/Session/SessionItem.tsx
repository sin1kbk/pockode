import type { SessionMeta } from "../../types/message";

interface Props {
	session: SessionMeta;
	isActive: boolean;
	onSelect: () => void;
	onDelete: () => void;
}

function SessionItem({ session, isActive, onSelect, onDelete }: Props) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={`group flex w-full cursor-pointer items-center justify-between rounded-lg p-3 text-left ${
				isActive
					? "bg-th-accent text-th-accent-text"
					: "text-th-text-secondary hover:bg-th-bg-tertiary"
			}`}
		>
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium">{session.title}</div>
				<div
					className={`text-xs ${isActive ? "opacity-70" : "text-th-text-muted"}`}
				>
					{new Date(session.created_at).toLocaleDateString()}
				</div>
			</div>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
				className={`ml-2 rounded p-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 ${
					isActive ? "hover:bg-th-accent-hover" : "hover:bg-th-bg-secondary"
				}`}
				aria-label="Delete session"
			>
				<svg
					className="h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					/>
				</svg>
			</button>
		</button>
	);
}

export default SessionItem;
