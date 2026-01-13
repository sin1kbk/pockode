import { GitBranch, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { WorktreeInfo } from "../../types/message";
import WorktreeItem from "./WorktreeItem";

interface Props {
	worktrees: WorktreeInfo[];
	current: string;
	onSelect: (worktree: WorktreeInfo) => void;
	onDelete: (worktree: WorktreeInfo) => void;
	onCreateNew: () => void;
	onClose: () => void;
	getDisplayName: (worktree: WorktreeInfo) => string;
	triggerRef?: React.RefObject<HTMLButtonElement | null>;
	isDesktop: boolean;
}

function WorktreeDropdown({
	worktrees,
	current,
	onSelect,
	onDelete,
	onCreateNew,
	onClose,
	getDisplayName,
	triggerRef,
	isDesktop,
}: Props) {
	const panelRef = useRef<HTMLDivElement>(null);
	const mobile = !isDesktop;

	// Filter out current worktree - dropdown shows "switch to" options only
	const switchableWorktrees = useMemo(() => {
		return worktrees.filter((wt) =>
			current ? wt.name !== current : !wt.is_main,
		);
	}, [worktrees, current]);

	const hasNoSwitchTargets = switchableWorktrees.length === 0;

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Element;
			if (triggerRef?.current?.contains(target)) {
				return;
			}
			// Ignore clicks inside portaled dialogs (e.g., delete confirmation)
			if (target.closest('[role="dialog"]')) {
				return;
			}
			if (panelRef.current && !panelRef.current.contains(target)) {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onClose, triggerRef]);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [onClose]);

	useEffect(() => {
		if (!mobile) return;

		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [mobile]);

	const content = (
		<div
			ref={panelRef}
			className={
				mobile
					? "fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col rounded-t-2xl border-t border-th-border bg-th-bg-secondary shadow-xl"
					: "absolute left-0 right-0 top-full z-50 mt-1 flex max-h-[50vh] flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg-secondary shadow-lg"
			}
			role="listbox"
			aria-label="Select worktree"
		>
			{mobile && (
				<>
					<div className="flex shrink-0 justify-center pt-3 pb-2">
						<div className="h-1 w-10 rounded-full bg-th-text-muted/30" />
					</div>
					<div className="flex items-center justify-between border-b border-th-border px-4 pb-3">
						<h2 className="text-sm font-semibold text-th-text-primary">
							Switch worktree
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="-mr-1 rounded p-1 text-th-text-muted hover:bg-th-bg-tertiary hover:text-th-text-primary"
							aria-label="Close"
						>
							<X className="h-5 w-5" />
						</button>
					</div>
				</>
			)}

			{hasNoSwitchTargets ? (
				<div className="flex flex-col items-center px-4 py-6 text-center">
					<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-th-bg-tertiary">
						<GitBranch className="h-5 w-5 text-th-text-muted" />
					</div>
					<p className="text-sm text-th-text-muted">No other worktrees yet</p>
				</div>
			) : (
				<div className="flex-1 overflow-y-auto py-2">
					{switchableWorktrees.map((worktree) => (
						<WorktreeItem
							key={worktree.name || "__main__"}
							worktree={worktree}
							isCurrent={false}
							displayName={getDisplayName(worktree)}
							onSelect={() => onSelect(worktree)}
							onDelete={() => onDelete(worktree)}
						/>
					))}
				</div>
			)}

			<div className="border-t border-th-border p-2">
				<button
					type="button"
					onClick={onCreateNew}
					className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-th-accent transition-colors hover:bg-th-accent/10"
				>
					<Plus className="h-4 w-4" />
					<span className="text-sm font-medium">New worktree</span>
				</button>
			</div>
		</div>
	);

	if (mobile) {
		return (
			<>
				{/* Backdrop - aria-hidden so click handler doesn't need keyboard equivalent */}
				<div
					className="fixed inset-0 z-40 bg-black/50"
					onClick={onClose}
					aria-hidden="true"
				/>
				{content}
			</>
		);
	}

	return content;
}

export default WorktreeDropdown;
