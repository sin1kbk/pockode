import type { FileStatus } from "../../types/git";
import { splitPath } from "../../utils/path";
import SidebarListItem from "../common/SidebarListItem";

interface Props {
	file: FileStatus;
	onSelect: () => void;
	isActive: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
	M: { label: "Modified", color: "text-th-warning" },
	A: { label: "Added", color: "text-th-success" },
	D: { label: "Deleted", color: "text-th-error" },
	R: { label: "Renamed", color: "text-th-accent" },
	"?": { label: "Untracked", color: "text-th-text-muted" },
};

function DiffFileItem({ file, onSelect, isActive }: Props) {
	const statusInfo = STATUS_LABELS[file.status] || STATUS_LABELS["?"];
	const { fileName, directory } = splitPath(file.path);

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
		/>
	);
}

export default DiffFileItem;
