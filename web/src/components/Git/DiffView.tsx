import { useGitDiff } from "../../hooks/useGitDiff";
import { Spinner } from "../ui";
import DiffContent from "./DiffContent";

interface Props {
	path: string;
	staged: boolean;
	onBack: () => void;
}

// DiffView replaces the message area, showing file path header and diff content
function DiffView({ path, staged, onBack }: Props) {
	const { data: diff, isLoading, error } = useGitDiff({ path, staged });

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			{/* File info bar with back button */}
			<div className="flex items-center gap-2 border-b border-th-border bg-th-bg-secondary px-3 py-2">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1 rounded-md border border-th-border bg-th-bg-tertiary px-2.5 py-1.5 text-sm font-medium text-th-text-secondary transition-colors hover:border-th-border-focus hover:bg-th-bg-primary hover:text-th-text-primary active:scale-[0.97]"
					aria-label="Back to chat"
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
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					<span>Chat</span>
				</button>
				<div className="min-w-0 flex-1">
					<span className="truncate text-sm font-medium text-th-text-primary">
						{path}
					</span>
					<span className="ml-2 text-xs text-th-text-muted">
						({staged ? "Staged" : "Unstaged"})
					</span>
				</div>
			</div>

			{/* Diff content */}
			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="flex items-center justify-center p-8">
						<Spinner className="text-th-text-muted" />
					</div>
				) : error ? (
					<div className="p-4 text-center text-th-error">
						<div className="font-medium">Failed to load diff</div>
						<div className="mt-1 text-sm text-th-text-muted">
							{error instanceof Error ? error.message : String(error)}
						</div>
					</div>
				) : diff !== undefined ? (
					<DiffContent diff={diff} />
				) : null}
			</div>
		</div>
	);
}

export default DiffView;
