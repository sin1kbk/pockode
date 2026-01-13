import { Check, Circle } from "lucide-react";
import type { WorktreeInfo } from "../../types/message";
import DeleteButton from "../common/DeleteButton";

interface Props {
	worktree: WorktreeInfo;
	isCurrent: boolean;
	displayName: string;
	onSelect: () => void;
	onDelete: () => void;
}

function WorktreeItem({
	worktree,
	isCurrent,
	displayName,
	onSelect,
	onDelete,
}: Props) {
	const showBranchSubtitle =
		worktree.branch !== worktree.name && worktree.branch !== displayName;

	return (
		/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: Keyboard navigation handled by listbox parent */
		<div
			onClick={onSelect}
			className={`group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
				isCurrent
					? "border-l-2 border-th-accent bg-th-accent/10"
					: "hover:bg-th-bg-tertiary"
			}`}
			role="option"
			aria-selected={isCurrent}
		>
			<div className="flex w-4 shrink-0 justify-center">
				{isCurrent ? (
					<Check className="h-4 w-4 text-th-accent" />
				) : (
					<Circle className="h-3 w-3 text-th-text-muted opacity-50" />
				)}
			</div>

			<div className="min-w-0 flex-1 text-left">
				<div className="flex items-center gap-2">
					<span
						className={`truncate text-sm ${
							isCurrent
								? "font-semibold text-th-text-primary"
								: "text-th-text-primary"
						}`}
					>
						{displayName}
					</span>
					{worktree.is_main && (
						<span className="shrink-0 rounded bg-th-bg-tertiary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-th-text-muted">
							Default
						</span>
					)}
				</div>
				{showBranchSubtitle && (
					<span className="mt-0.5 block truncate text-xs text-th-text-muted">
						{worktree.branch}
					</span>
				)}
			</div>

			{!worktree.is_main && (
				<DeleteButton
					itemName={displayName}
					itemType="worktree"
					onDelete={onDelete}
					confirmMessage={`This will remove the worktree "${displayName}" and its working directory. This action cannot be undone.`}
					className="shrink-0 rounded p-1 text-th-text-muted transition-all hover:bg-th-error/10 hover:text-th-error sm:opacity-0 sm:group-hover:opacity-100"
				/>
			)}
		</div>
	);
}

export default WorktreeItem;
