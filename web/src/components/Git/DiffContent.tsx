import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import { getDiffViewHighlighter } from "@git-diff-view/shiki";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { useEffect, useState, useSyncExternalStore } from "react";

// Subscribe to dark mode changes on document element
function subscribeToDarkMode(callback: () => void) {
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.attributeName === "class") {
				callback();
			}
		}
	});
	observer.observe(document.documentElement, { attributes: true });
	return () => observer.disconnect();
}

function getIsDarkMode() {
	return document.documentElement.classList.contains("dark");
}

interface Props {
	diff: string;
	fileName: string;
}

// Cache the highlighter instance globally
let highlighterPromise: ReturnType<typeof getDiffViewHighlighter> | null = null;

function getHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = getDiffViewHighlighter();
	}
	return highlighterPromise;
}

function DiffContent({ diff, fileName }: Props) {
	const isDark = useSyncExternalStore(subscribeToDarkMode, getIsDarkMode);
	const [highlighter, setHighlighter] = useState<Awaited<
		ReturnType<typeof getDiffViewHighlighter>
	> | null>(null);

	useEffect(() => {
		getHighlighter().then(setHighlighter);
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
