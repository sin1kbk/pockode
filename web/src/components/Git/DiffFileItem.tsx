import type { FileStatus } from "../../types/git";

interface Props {
	file: FileStatus;
	onSelect: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
	M: { label: "Modified", color: "text-th-warning" },
	A: { label: "Added", color: "text-th-success" },
	D: { label: "Deleted", color: "text-th-error" },
	R: { label: "Renamed", color: "text-th-accent" },
	"?": { label: "Untracked", color: "text-th-text-muted" },
};

function DiffFileItem({ file, onSelect }: Props) {
	const statusInfo = STATUS_LABELS[file.status] || STATUS_LABELS["?"];

	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex w-full min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-left text-th-text-secondary hover:bg-th-bg-tertiary"
			aria-label={`View ${statusInfo.label.toLowerCase()} file: ${file.path}`}
		>
			<span
				className={`shrink-0 text-xs font-medium ${statusInfo.color}`}
				title={statusInfo.label}
			>
				{file.status}
			</span>
			<span className="min-w-0 flex-1 truncate text-sm">{file.path}</span>
			<svg
				className="h-4 w-4 shrink-0 text-th-text-muted"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9 5l7 7-7 7"
				/>
			</svg>
		</button>
	);
}

export default DiffFileItem;
