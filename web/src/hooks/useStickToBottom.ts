import { type RefObject, useEffect, useRef } from "react";

/**
 * Keeps a scrollable container stuck to the bottom when content height grows.
 * Uses polling because ResizeObserver doesn't reliably catch inner element height changes.
 */
export function useStickToBottom(
	containerRef: RefObject<HTMLDivElement | null>,
	enabled: boolean,
) {
	const prevScrollHeightRef = useRef(0);

	useEffect(() => {
		if (!enabled) return;

		const container = containerRef.current;
		if (!container) return;

		prevScrollHeightRef.current = container.scrollHeight;

		const intervalId = setInterval(() => {
			const { scrollTop, scrollHeight, clientHeight } = container;

			if (scrollHeight !== prevScrollHeightRef.current) {
				const heightDelta = scrollHeight - prevScrollHeightRef.current;
				const distanceFromBottom =
					prevScrollHeightRef.current - scrollTop - clientHeight;

				// If we were at bottom before height change, stay at bottom
				if (heightDelta > 0 && distanceFromBottom <= 50) {
					container.scrollTop = scrollHeight - clientHeight;
				}

				prevScrollHeightRef.current = scrollHeight;
			}
		}, 100);

		return () => clearInterval(intervalId);
	}, [containerRef, enabled]);
}
