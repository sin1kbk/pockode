import { useCallback, useMemo, useState } from "react";
import { useGitStage } from "../../hooks/useGitStage";
import { useGitStatus } from "../../hooks/useGitStatus";
import { useGitWatch } from "../../hooks/useGitWatch";
import { flattenGitStatus } from "../../types/git";
import { useSidebarRefresh } from "../Layout";
import { PullToRefresh, Spinner } from "../ui";
import DiffFileList from "./DiffFileList";

interface Props {
	onSelectFile: (path: string, staged: boolean) => void;
	activeFile: { path: string; staged: boolean } | null;
}

function DiffTab({ onSelectFile, activeFile }: Props) {
	const { data: status, isLoading, error, refresh } = useGitStatus();
	const { isActive } = useSidebarRefresh("diff", refresh);
	const { stageMutation, unstageMutation } = useGitStage();
	const [togglingPaths, setTogglingPaths] = useState<Set<string>>(new Set());

	useGitWatch({ onChanged: refresh, enabled: isActive });

	const flatStatus = useMemo(
		() => (status ? flattenGitStatus(status) : null),
		[status],
	);

	const togglePaths = useCallback(
		async (paths: string[], staged: boolean) => {
			setTogglingPaths((prev) => new Set([...prev, ...paths]));
			try {
				if (staged) {
					await unstageMutation.mutateAsync(paths);
				} else {
					await stageMutation.mutateAsync(paths);
				}
			} finally {
				setTogglingPaths((prev) => {
					const next = new Set(prev);
					for (const p of paths) next.delete(p);
					return next;
				});
			}
		},
		[stageMutation, unstageMutation],
	);

	const handleToggleStage = useCallback(
		(path: string, staged: boolean) => togglePaths([path], staged),
		[togglePaths],
	);

	const handleToggleAllStaged = useCallback(() => {
		if (!flatStatus || flatStatus.staged.length === 0) return;
		togglePaths(
			flatStatus.staged.map((f) => f.path),
			true,
		);
	}, [flatStatus, togglePaths]);

	const handleToggleAllUnstaged = useCallback(() => {
		if (!flatStatus || flatStatus.unstaged.length === 0) return;
		togglePaths(
			flatStatus.unstaged.map((f) => f.path),
			false,
		);
	}, [flatStatus, togglePaths]);

	return (
		<div
			className={isActive ? "flex flex-1 flex-col overflow-hidden" : "hidden"}
		>
			<PullToRefresh onRefresh={refresh}>
				{isLoading ? (
					<div className="flex items-center justify-center p-8">
						<Spinner className="text-th-text-muted" />
					</div>
				) : error ? (
					<div className="p-4 text-center text-th-error">
						<div className="font-medium">Failed to load git status</div>
						<div className="mt-1 text-sm text-th-text-muted">
							{error instanceof Error ? error.message : String(error)}
						</div>
					</div>
				) : !flatStatus ||
					(flatStatus.staged.length === 0 &&
						flatStatus.unstaged.length === 0) ? (
					<div className="p-4 text-center text-th-text-muted">
						No changes to display
					</div>
				) : (
					<div className="flex flex-1 flex-col gap-4 py-2">
						<DiffFileList
							title="Staged"
							files={flatStatus.staged}
							staged={true}
							onSelectFile={onSelectFile}
							onToggleStage={(path) => handleToggleStage(path, true)}
							onToggleAll={handleToggleAllStaged}
							activeFile={activeFile}
							togglingPaths={togglingPaths}
						/>
						<DiffFileList
							title="Unstaged"
							files={flatStatus.unstaged}
							staged={false}
							onSelectFile={onSelectFile}
							onToggleStage={(path) => handleToggleStage(path, false)}
							onToggleAll={handleToggleAllUnstaged}
							activeFile={activeFile}
							togglingPaths={togglingPaths}
						/>
					</div>
				)}
			</PullToRefresh>
		</div>
	);
}

export default DiffTab;
