import { useMemo } from "react";
import { useFSWatch } from "../../hooks/useFSWatch";
import { useGitStatus } from "../../hooks/useGitStatus";
import { flattenGitStatus, type GitStatus } from "../../types/git";
import { useSidebarRefresh } from "../Layout";
import { PullToRefresh, Spinner } from "../ui";
import DiffFileList from "./DiffFileList";

/**
 * Watch git index files for changes.
 * Watches root .git/index and up to 10 submodule indexes.
 */
function useGitIndexWatch(
	status: GitStatus | undefined,
	onChanged: () => void,
	enabled: boolean,
) {
	useFSWatch(enabled ? ".git/index" : null, onChanged);

	const submodulePaths = useMemo(
		() => Object.keys(status?.submodules ?? {}),
		[status?.submodules],
	);

	// Watch up to 10 submodule indexes (hook count must be stable)
	const maxSubmodules = 10;
	for (let i = 0; i < maxSubmodules; i++) {
		const path = submodulePaths[i];
		// biome-ignore lint/correctness/useHookAtTopLevel: hook count is stable (always maxSubmodules calls)
		useFSWatch(
			enabled && path ? `.git/modules/${path}/index` : null,
			onChanged,
		);
	}
}

interface Props {
	onSelectFile: (path: string, staged: boolean) => void;
	activeFile: { path: string; staged: boolean } | null;
}

function DiffTab({ onSelectFile, activeFile }: Props) {
	const { data: status, isLoading, error, refresh } = useGitStatus();
	const { isActive } = useSidebarRefresh("diff", refresh);

	useGitIndexWatch(status, refresh, isActive);

	const flatStatus = useMemo(
		() => (status ? flattenGitStatus(status) : null),
		[status],
	);

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
							activeFile={activeFile}
						/>
						<DiffFileList
							title="Unstaged"
							files={flatStatus.unstaged}
							staged={false}
							onSelectFile={onSelectFile}
							activeFile={activeFile}
						/>
					</div>
				)}
			</PullToRefresh>
		</div>
	);
}

export default DiffTab;
