import { useState } from "react";
import type { ContentPart, Message, ToolCall } from "../../types/message";
import { Spinner } from "../ui";
import { MarkdownContent } from "./MarkdownContent";

interface ToolCallItemProps {
	tool: ToolCall;
}

/** Extract a short summary from tool input for display */
function getToolSummary(tool: ToolCall): string {
	const input = tool.input;
	if (!input || typeof input !== "object") return "";

	const obj = input as Record<string, unknown>;

	// Bash: show description or truncated command
	if (tool.name === "Bash") {
		if (typeof obj.description === "string") return obj.description;
		if (typeof obj.command === "string") {
			const cmd = obj.command;
			return cmd.length > 50 ? `${cmd.slice(0, 50)}...` : cmd;
		}
	}

	// Read/Edit/Write: show file path
	if (typeof obj.file_path === "string") {
		const path = obj.file_path;
		// Show just the filename or last part of path
		const pathParts = path.split("/");
		return pathParts.length > 2 ? `.../${pathParts.slice(-2).join("/")}` : path;
	}

	// Grep: show pattern
	if (tool.name === "Grep" && typeof obj.pattern === "string") {
		return `"${obj.pattern}"`;
	}

	// Glob: show pattern
	if (tool.name === "Glob" && typeof obj.pattern === "string") {
		return obj.pattern;
	}

	return "";
}

function ToolCallItem({ tool }: ToolCallItemProps) {
	const [expanded, setExpanded] = useState(false);
	const hasResult = Boolean(tool.result);
	const summary = getToolSummary(tool);

	return (
		<div className="rounded bg-th-bg-secondary text-xs">
			<button
				type="button"
				onClick={() => hasResult && setExpanded(!expanded)}
				className={`flex w-full items-center gap-1.5 rounded p-2 text-left ${hasResult ? "hover:bg-th-overlay-hover" : ""}`}
			>
				<span
					className={`w-2.5 shrink-0 text-th-text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
				>
					{hasResult && "▶"}
				</span>
				<span className="shrink-0 text-th-accent">{tool.name}</span>
				{summary && (
					<span className="truncate text-th-text-muted">{summary}</span>
				)}
			</button>
			{expanded && tool.result && (
				<pre className="max-h-48 overflow-auto border-t border-th-border p-2 text-th-text-muted">
					{tool.result}
				</pre>
			)}
		</div>
	);
}

interface SystemItemProps {
	content: string;
}

function SystemItem({ content }: SystemItemProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="rounded bg-th-bg-secondary text-xs">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-1.5 rounded p-2 text-left hover:bg-th-overlay-hover"
			>
				<span
					className={`w-2.5 shrink-0 text-th-text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
				>
					▶
				</span>
				<span className="italic text-th-text-muted">system</span>
			</button>
			{expanded && (
				<pre className="max-h-48 overflow-auto border-t border-th-border p-2 text-th-text-muted">
					{content}
				</pre>
			)}
		</div>
	);
}

interface ContentPartItemProps {
	part: ContentPart;
}

function ContentPartItem({ part }: ContentPartItemProps) {
	if (part.type === "text") {
		return <MarkdownContent content={part.content} />;
	}
	if (part.type === "system") {
		return <SystemItem content={part.content} />;
	}
	return <ToolCallItem tool={part.tool} />;
}

interface Props {
	message: Message;
}

function MessageItem({ message }: Props) {
	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div className="max-w-[80%] rounded-lg bg-th-user-bubble p-2.5 text-th-user-bubble-text sm:p-3">
					<p className="whitespace-pre-wrap break-words">{message.content}</p>
				</div>
			</div>
		);
	}

	// Assistant message
	return (
		<div className="flex justify-start">
			<div className="max-w-[80%] rounded-lg bg-th-ai-bubble p-2.5 text-th-ai-bubble-text sm:p-3">
				{message.parts.length > 0 && (
					<div className="space-y-2">
						{message.parts.map((part, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
							<ContentPartItem key={index} part={part} />
						))}
					</div>
				)}

				{/* Status indicator */}
				{(message.status === "sending" || message.status === "streaming") && (
					<Spinner className="mt-2" />
				)}
				{message.status === "error" && (
					<p className="mt-2 text-sm text-th-error">{message.error}</p>
				)}
				{message.status === "interrupted" && (
					<p className="mt-2 text-sm text-th-text-muted">Interrupted</p>
				)}
				{message.status === "process_ended" && (
					<p className="mt-2 text-sm text-th-warning">Process ended</p>
				)}
			</div>
		</div>
	);
}

export default MessageItem;
