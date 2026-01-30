import { getDiffViewHighlighter } from "@git-diff-view/shiki";
import { useShikiHighlighter } from "react-shiki";
import { bundledLanguagesInfo, createCssVariablesTheme } from "shiki";
import { useIsDesktop } from "../hooks/useIsDesktop";

export const CODE_FONT_SIZE_MOBILE = 12;
export const CODE_FONT_SIZE_DESKTOP = 13;

const EXT_MAP: Record<string, string> = {};
for (const lang of bundledLanguagesInfo) {
	EXT_MAP[lang.id] = lang.id;
	if (lang.aliases) {
		for (const alias of lang.aliases) {
			EXT_MAP[alias] = lang.id;
		}
	}
}

export function getLanguageFromPath(path: string): string | undefined {
	const fileName = path.split("/").pop() ?? "";

	if (fileName.toLowerCase() === "dockerfile") return "docker";
	if (fileName.startsWith(".env")) return "shellscript";

	const ext = fileName.split(".").pop()?.toLowerCase();
	return ext ? EXT_MAP[ext] : undefined;
}

export function isMarkdownFile(path: string): boolean {
	const ext = path.split(".").pop()?.toLowerCase();
	return ext === "md" || ext === "mdx";
}

let highlighterPromise: ReturnType<typeof getDiffViewHighlighter> | null = null;

export function getDiffHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = getDiffViewHighlighter();
	}
	return highlighterPromise;
}

export function subscribeToDarkMode(callback: () => void) {
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

export function getIsDarkMode() {
	return document.documentElement.classList.contains("dark");
}

const cssVarTheme = createCssVariablesTheme({
	name: "css-variables",
	variablePrefix: "--shiki-",
});

export function CodeHighlighter({
	children,
	language,
}: {
	children: string;
	language?: string;
}) {
	const isDesktop = useIsDesktop();
	const fontSize = isDesktop ? CODE_FONT_SIZE_DESKTOP : CODE_FONT_SIZE_MOBILE;

	const highlighted = useShikiHighlighter(children, language, cssVarTheme);

	const style = { "--code-font-size": `${fontSize}px` } as React.CSSProperties;

	return (
		<pre className="code-block" style={style}>
			{highlighted ?? <code>{children}</code>}
		</pre>
	);
}
