import type { Element } from "hast";
import type { ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import ShikiHighlighter, { isInlineCode } from "react-shiki";
import remarkGfm from "remark-gfm";

type CodeProps = ComponentPropsWithoutRef<"code"> & {
	node?: Element;
};

function CodeBlock({ className, children, node }: CodeProps) {
	const code = String(children).trimEnd();
	const match = className?.match(/language-(\w+)/);
	const language = match ? match[1] : undefined;
	const isInline = node ? isInlineCode(node) : !language;

	if (isInline) {
		return (
			<code className="rounded bg-gray-800 px-1.5 py-0.5 text-sm text-gray-200">
				{children}
			</code>
		);
	}

	return (
		<ShikiHighlighter language={language} theme="github-dark">
			{code}
		</ShikiHighlighter>
	);
}

interface MarkdownContentProps {
	content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
	return (
		<div className="prose prose-invert prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none">
			<Markdown
				remarkPlugins={[remarkGfm]}
				components={{
					code: CodeBlock,
				}}
			>
				{content}
			</Markdown>
		</div>
	);
}
