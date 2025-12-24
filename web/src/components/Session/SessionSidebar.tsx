import { useEffect } from "react";
import type { SessionMeta } from "../../types/message";
import SessionList from "./SessionList";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	sessions: SessionMeta[];
	currentSessionId: string | null;
	onSelectSession: (id: string) => void;
	onCreateSession: () => void;
	onDeleteSession: (id: string) => void;
	isLoading: boolean;
}

function SessionSidebar({
	isOpen,
	onClose,
	sessions,
	currentSessionId,
	onSelectSession,
	onCreateSession,
	onDeleteSession,
	isLoading,
}: Props) {
	// Close on Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				onClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop */}
			<button
				type="button"
				className="fixed inset-0 z-40 bg-black/50"
				onClick={onClose}
				aria-label="Close sidebar"
			/>

			{/* Sidebar */}
			<div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-gray-800">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-gray-700 p-4">
					<h2 className="font-semibold text-white">Conversations</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
						aria-label="Close sidebar"
					>
						<svg
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* New Chat Button */}
				<div className="p-2">
					<button
						type="button"
						onClick={onCreateSession}
						className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 p-3 font-medium text-white hover:bg-blue-700"
					>
						<svg
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 4v16m8-8H4"
							/>
						</svg>
						New Chat
					</button>
				</div>

				{/* Session List */}
				<div className="flex-1 overflow-y-auto">
					{isLoading ? (
						<div className="p-4 text-center text-gray-500">Loading...</div>
					) : (
						<SessionList
							sessions={sessions}
							currentSessionId={currentSessionId}
							onSelectSession={(id) => {
								onSelectSession(id);
								onClose();
							}}
							onDeleteSession={onDeleteSession}
						/>
					)}
				</div>
			</div>
		</>
	);
}

export default SessionSidebar;
