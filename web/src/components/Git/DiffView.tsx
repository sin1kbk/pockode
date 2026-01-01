import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { useGitDiff } from "../../hooks/useGitDiff";
import { useGitStatus } from "../../hooks/useGitStatus";
import type { DiffSearchParams } from "../../router";
import { splitPath } from "../../utils/path";
import { Spinner } from "../ui";
import DiffContent from "./DiffContent";

interface Props {
	path: string;
	staged: boolean;
	onBack: () => void;
}

function PathDisplay({ path, staged }: { path: string; staged: boolean }) {
	const { fileName, directory } = splitPath(path);
	const statusColor = staged ? "text-th-success" : "text-th-warning";
	return (
		<div className="min-w-0 flex-1">
			<div className={`truncate text-sm font-medium ${statusColor}`}>
				{fileName}
			</div>
			{directory && (
				<div className="truncate text-xs text-th-text-muted">{directory}</div>
			)}
		</div>
	);
}

function DiffView({ path, staged, onBack }: Props) {
	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as DiffSearchParams;
	const sessionId = search.session;
	const { data: diff, isLoading, error } = useGitDiff({ path, staged });
	const { data: gitStatus } = useGitStatus();

	const allFiles = useMemo(() => {
		if (!gitStatus) return [];
		return [
			...gitStatus.staged.map((f) => ({ ...f, staged: true })),
			...gitStatus.unstaged.map((f) => ({ ...f, staged: false })),
		];
	}, [gitStatus]);

	const currentIndex = allFiles.findIndex(
		(f) => f.path === path && f.staged === staged,
	);
	const prev = currentIndex > 0 ? allFiles[currentIndex - 1] : null;
	const next =
		currentIndex >= 0 && currentIndex < allFiles.length - 1
			? allFiles[currentIndex + 1]
			: null;

	const navigateTo = (file: { path: string; staged: boolean }) => {
		navigate({
			to: file.staged ? "/staged/$" : "/unstaged/$",
			params: { _splat: file.path },
			search: sessionId ? { session: sessionId } : {},
		});
	};

	const navButtonClass = (enabled: boolean) =>
		`flex items-center justify-center rounded-md border border-th-border bg-th-bg-tertiary min-h-[44px] min-w-[44px] p-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-th-accent ${
			enabled
				? "text-th-text-secondary hover:border-th-border-focus hover:bg-th-bg-primary hover:text-th-text-primary active:scale-[0.97]"
				: "cursor-not-allowed opacity-40"
		}`;

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex items-center gap-1.5 border-b border-th-border bg-th-bg-secondary px-2 py-2">
				<button
					type="button"
					onClick={onBack}
					className={navButtonClass(true)}
					aria-label="Back to chat"
				>
					<MessageSquare className="h-5 w-5" aria-hidden="true" />
				</button>

				<div className="flex items-center">
					<button
						type="button"
						disabled={!prev}
						onClick={() => prev && navigateTo(prev)}
						className={navButtonClass(!!prev)}
						aria-label="Previous file"
					>
						<ChevronLeft className="h-5 w-5" aria-hidden="true" />
					</button>
					<button
						type="button"
						disabled={!next}
						onClick={() => next && navigateTo(next)}
						className={navButtonClass(!!next)}
						aria-label="Next file"
					>
						<ChevronRight className="h-5 w-5" aria-hidden="true" />
					</button>
				</div>

				<PathDisplay path={path} staged={staged} />
			</div>

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
					<DiffContent diff={diff} fileName={path} />
				) : null}
			</div>
		</div>
	);
}

export default DiffView;
