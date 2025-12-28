import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../../types/message";
import MessageItem from "./MessageItem";

interface Props {
	messages: Message[];
	sessionId: string;
}

function MessageList({ messages, sessionId }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [isScrolledUp, setIsScrolledUp] = useState(false);
	const isScrolledUpRef = useRef(isScrolledUp);
	const prevScrollHeightRef = useRef(0);

	// Keep ref in sync with state for use in ResizeObserver callback
	useEffect(() => {
		isScrolledUpRef.current = isScrolledUp;
	}, [isScrolledUp]);

	// When switching sessions, reset scroll state so the messages effect will auto-scroll to bottom.
	// Without this, if user scrolled up in Session A (isScrolledUp=true) and switches to Session B,
	// the state persists and prevents auto-scrolling to the latest messages.
	// biome-ignore lint/correctness/useExhaustiveDependencies: sessionId triggers reset on session switch
	useEffect(() => {
		setIsScrolledUp(false);
	}, [sessionId]);

	// Detect user scroll: if scrolling away from bottom, mark as scrolled up
	const handleScroll = () => {
		const container = containerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const threshold = 50;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		// When content height changes (e.g., markdown renders, code expands),
		// avoid incorrectly marking as "scrolled up" due to height growth.
		// But if we're at the bottom, ensure isScrolledUp stays false.
		if (scrollHeight !== prevScrollHeightRef.current) {
			prevScrollHeightRef.current = scrollHeight;
			if (distanceFromBottom <= threshold) {
				setIsScrolledUp(false);
			}
			return;
		}

		setIsScrolledUp(distanceFromBottom > threshold);
	};

	const scrollToBottom = useCallback(() => {
		const container = containerRef.current;
		if (container) {
			container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
		}
	}, []);

	// Auto scroll to bottom only if user hasn't scrolled up
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages triggers scroll on any update
	useEffect(() => {
		if (!isScrolledUp) {
			scrollToBottom();
		}
	}, [messages]);

	// Watch for content height changes (e.g., code block expansion)
	useEffect(() => {
		const content = contentRef.current;
		if (!content) return;

		const observer = new ResizeObserver(() => {
			if (!isScrolledUpRef.current) {
				scrollToBottom();
			}
		});

		observer.observe(content);
		return () => observer.disconnect();
	}, [scrollToBottom]);

	return (
		<div className="relative min-h-0 flex-1">
			{messages.length === 0 ? (
				<div className="flex h-full items-center justify-center text-th-text-muted">
					<p>Start a conversation...</p>
				</div>
			) : (
				<div
					ref={containerRef}
					onScroll={handleScroll}
					className="h-full overflow-y-auto p-3 sm:p-4"
				>
					<div ref={contentRef} className="space-y-3 sm:space-y-4">
						{messages.map((message) => (
							<MessageItem key={message.id} message={message} />
						))}
					</div>
				</div>
			)}
			{isScrolledUp && (
				<button
					type="button"
					onClick={scrollToBottom}
					className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-th-border bg-th-bg-primary p-2 text-th-text-secondary shadow-xl transition-colors hover:bg-th-bg-secondary hover:text-th-text-primary"
					aria-label="Scroll to bottom"
				>
					<svg
						className="h-5 w-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 14l-7 7m0 0l-7-7m7 7V3"
						/>
					</svg>
				</button>
			)}
		</div>
	);
}

export default MessageList;
