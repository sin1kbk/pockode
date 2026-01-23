import { Loader2, Minus, Plus } from "lucide-react";
import type { FileStatus } from "../../types/git";
import { splitPath } from "../../utils/path";
import SidebarListItem from "../common/SidebarListItem";

interface Props {
	file: FileStatus;
	staged: boolean;
	onSelect: () => void;
	onToggleStage: () => void;
	isActive: boolean;
	isToggling?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
	M: { label: "Modified", color: "text-th-warning" },
	A: { label: "Added", color: "text-th-success" },
	D: { label: "Deleted", color: "text-th-error" },
	R: { label: "Renamed", color: "text-th-accent" },
	"?": { label: "Untracked", color: "text-th-text-muted" },
};

function DiffFileItem({
	file,
	staged,
	onSelect,
	onToggleStage,
	isActive,
	isToggling,
}: Props) {
	const statusInfo = STATUS_LABELS[file.status] || STATUS_LABELS["?"];
	const { fileName, directory } = splitPath(file.path);

	const Icon = staged ? Minus : Plus;
	const actionLabel = staged ? "Unstage file" : "Stage file";
	const iconColor = staged ? "text-th-warning" : "text-th-success";

	return (
		<SidebarListItem
			title={fileName}
			subtitle={directory}
			isActive={isActive}
			onSelect={onSelect}
			ariaLabel={`View ${statusInfo.label.toLowerCase()} file: ${file.path}`}
			leftSlot={
				<span
					className={`shrink-0 self-start mt-0.5 text-xs font-medium ${statusInfo.color}`}
					title={statusInfo.label}
				>
					{file.status}
				</span>
			}
			actions={
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onToggleStage();
					}}
					disabled={isToggling}
					className={`flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-th-accent ${
						isToggling
							? "opacity-50 cursor-not-allowed"
							: `${iconColor} hover:bg-th-bg-primary active:scale-95`
					}`}
					aria-label={actionLabel}
				>
					{isToggling ? (
						<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
					) : (
						<Icon className="h-5 w-5" aria-hidden="true" />
					)}
				</button>
			}
		/>
	);
}

export default DiffFileItem;
