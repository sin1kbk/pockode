import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import type { getDiffViewHighlighter } from "@git-diff-view/shiki";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
	getDiffHighlighter,
	getIsDarkMode,
	subscribeToDarkMode,
} from "../../lib/shikiUtils";

interface Props {
	diff: string;
	fileName: string;
}

function DiffContent({ diff, fileName }: Props) {
	const isDark = useSyncExternalStore(subscribeToDarkMode, getIsDarkMode);
	const [highlighter, setHighlighter] = useState<Awaited<
		ReturnType<typeof getDiffViewHighlighter>
	> | null>(null);

	useEffect(() => {
		getDiffHighlighter().then(setHighlighter);
	}, []);

	if (/^Binary files .+ and .+ differ$/m.test(diff)) {
		return (
			<div className="p-4 text-center text-th-text-muted">
				Binary file - cannot display diff
			</div>
		);
	}

	if (!diff.trim()) {
		return (
			<div className="p-4 text-center text-th-text-muted">
				No diff content to display
			</div>
		);
	}

	if (!highlighter) {
		return <div className="p-4 text-center text-th-text-muted">Loading...</div>;
	}

	// TODO: Pass oldFile.content and newFile.content for full syntax highlighting
	// Currently only diff output is available; library needs full file content for syntax context
	return (
		<div className="diff-view-wrapper diff-tailwindcss-wrapper">
			<DiffView
				data={{
					oldFile: { fileName },
					newFile: { fileName },
					hunks: [diff],
				}}
				registerHighlighter={highlighter}
				diffViewMode={DiffModeEnum.Unified}
				diffViewTheme={isDark ? "dark" : "light"}
				diffViewHighlight
			/>
		</div>
	);
}

export default DiffContent;
