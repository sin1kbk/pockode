import { type KeyboardEvent, useCallback, useMemo, useState } from "react";

interface Props {
	onSend: (content: string) => void;
	disabled?: boolean;
	isStreaming?: boolean;
	onInterrupt?: () => void;
}

function InputBar({
	onSend,
	disabled = false,
	isStreaming = false,
	onInterrupt,
}: Props) {
	const [input, setInput] = useState("");
	const isMac = useMemo(
		() =>
			typeof navigator !== "undefined" &&
			/Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
		[],
	);
	const shortcutHint = isMac ? "⌘↵" : "Ctrl↵";

	const handleSend = useCallback(() => {
		const trimmed = input.trim();
		if (trimmed && !disabled && !isStreaming) {
			onSend(trimmed);
			setInput("");
		}
	}, [input, onSend, disabled, isStreaming]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	return (
		<div className="border-t border-gray-700 p-3 sm:p-4">
			<div className="flex gap-2">
				<textarea
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Type a message..."
					disabled={disabled}
					rows={1}
					className="min-h-[44px] flex-1 resize-none rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 sm:px-4"
				/>
				{isStreaming ? (
					<button
						type="button"
						onClick={onInterrupt}
						className="min-h-[44px] rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700 sm:px-4"
					>
						Stop
						<span className="hidden text-red-300 text-xs sm:inline"> Esc</span>
					</button>
				) : (
					<button
						type="button"
						onClick={handleSend}
						disabled={disabled || !input.trim()}
						className="min-h-[44px] rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
					>
						Send
						<span className="hidden text-blue-300 text-xs sm:inline">
							{" "}
							{shortcutHint}
						</span>
					</button>
				)}
			</div>
		</div>
	);
}

export default InputBar;
