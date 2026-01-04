import { ArrowDown, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
	onRefresh: () => Promise<void> | void;
	children: React.ReactNode;
	className?: string;
}

const THRESHOLD = 60;
const MAX_PULL = 100;
const INDICATOR_SIZE = 32;

type Status = "idle" | "pulling" | "ready" | "refreshing" | "done";

/**
 * Pull-to-refresh container for mobile-friendly refresh gesture.
 * Uses CSS transforms for smooth 60fps animations.
 */
function PullToRefresh({ onRefresh, children, className = "" }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const indicatorRef = useRef<HTMLDivElement>(null);
	const pullRef = useRef(0);
	const startYRef = useRef<number | null>(null);
	const statusRef = useRef<Status>("idle");
	const mountedRef = useRef(true);
	// Only for icon rendering - minimal re-renders
	const [iconState, setIconState] = useState<"arrow" | "spinner" | "check">(
		"arrow",
	);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const updateVisuals = useCallback(
		(pull: number, status: Status, animate = false) => {
			const wrapper = wrapperRef.current;
			const indicator = indicatorRef.current;
			if (!wrapper || !indicator) return;

			const progress = Math.min(pull / THRESHOLD, 1);
			const isReady = status === "ready";
			const isActive =
				status === "ready" || status === "refreshing" || status === "done";

			const transition = animate
				? "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
				: "none";

			wrapper.style.transition = transition;
			wrapper.style.transform = `translateY(${pull}px)`;

			indicator.style.transition = animate
				? `${transition}, opacity 0.2s, background-color 0.15s`
				: "none";
			indicator.style.opacity = String(Math.max(0.4, progress));
			indicator.style.transform = `translateY(${pull - INDICATOR_SIZE - 8}px) rotate(${isReady ? 180 : 0}deg) scale(${0.7 + progress * 0.3})`;
			indicator.style.backgroundColor = isActive
				? "var(--th-accent)"
				: "var(--th-bg-tertiary)";
		},
		[],
	);

	const reset = useCallback(() => {
		startYRef.current = null;
		pullRef.current = 0;
		statusRef.current = "idle";
		updateVisuals(0, "idle", true);
	}, [updateVisuals]);

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		if (statusRef.current === "refreshing") return;
		const el = containerRef.current;
		if (!el || el.scrollTop > 0) return;

		startYRef.current = e.touches[0].clientY;
		pullRef.current = 0;
	}, []);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (statusRef.current === "refreshing" || startYRef.current === null)
				return;
			const el = containerRef.current;
			if (!el) return;

			const currentY = e.touches[0].clientY;
			const deltaY = currentY - startYRef.current;

			if (deltaY > 0 && el.scrollTop === 0) {
				e.preventDefault();
				// Rubber band: pull = MAX_PULL * (1 - e^(-deltaY/k))
				const pull = MAX_PULL * (1 - Math.exp(-deltaY / 200));
				pullRef.current = pull;
				statusRef.current = pull >= THRESHOLD ? "ready" : "pulling";
				updateVisuals(pull, statusRef.current);
			}
		},
		[updateVisuals],
	);

	const finishRefresh = useCallback(() => {
		if (!mountedRef.current) return;
		updateVisuals(0, "idle", true);
		pullRef.current = 0;
		setTimeout(() => {
			if (!mountedRef.current) return;
			statusRef.current = "idle";
			setIconState("arrow");
		}, 250);
	}, [updateVisuals]);

	const handleTouchEnd = useCallback(() => {
		if (startYRef.current === null) return;
		startYRef.current = null;

		const pull = pullRef.current;
		if (pull >= THRESHOLD && statusRef.current !== "refreshing") {
			statusRef.current = "refreshing";
			setIconState("spinner");
			updateVisuals(INDICATOR_SIZE + 16, "refreshing", true);

			(async () => {
				try {
					await onRefresh();
					if (!mountedRef.current) return;
					statusRef.current = "done";
					setIconState("check");
					await new Promise((r) => setTimeout(r, 350));
					finishRefresh();
				} catch {
					finishRefresh();
				}
			})();
		} else {
			reset();
		}
	}, [onRefresh, updateVisuals, reset, finishRefresh]);

	return (
		<div
			className={`relative flex flex-1 flex-col overflow-hidden ${className}`}
		>
			<div
				ref={indicatorRef}
				className="pointer-events-none absolute left-1/2 z-10 flex items-center justify-center rounded-full will-change-transform"
				style={{
					width: INDICATOR_SIZE,
					height: INDICATOR_SIZE,
					marginLeft: -INDICATOR_SIZE / 2,
					opacity: 0,
					transform: `translateY(-${INDICATOR_SIZE + 8}px)`,
					backgroundColor: "var(--th-bg-tertiary)",
				}}
			>
				{iconState === "check" ? (
					<Check
						className="h-4 w-4"
						style={{ color: "var(--th-accent-text)" }}
						strokeWidth={2.5}
					/>
				) : iconState === "spinner" ? (
					<div
						className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
						style={{ color: "var(--th-accent-text)" }}
					/>
				) : (
					<ArrowDown
						className="h-4 w-4"
						style={{ color: "var(--th-text-muted)" }}
						strokeWidth={2.5}
					/>
				)}
			</div>

			<div
				ref={wrapperRef}
				className="flex flex-1 flex-col overflow-hidden will-change-transform"
			>
				<div
					ref={containerRef}
					className="flex flex-1 flex-col overflow-y-auto"
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
					onTouchCancel={reset}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

export default PullToRefresh;
