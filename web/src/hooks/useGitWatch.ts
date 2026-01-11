import { useEffect, useRef } from "react";
import { useWSStore } from "../lib/wsStore";

/**
 * Watch for git status changes.
 * When git status changes, the callback is invoked.
 * Unlike useFSWatch, this watches overall git status, not specific files.
 *
 * @param onChanged - Callback to invoke when git status changes
 * @param enabled - Whether to enable watching (default: true)
 */
export function useGitWatch(onChanged: () => void, enabled = true): void {
	const gitSubscribe = useWSStore((s) => s.actions.gitSubscribe);
	const gitUnsubscribe = useWSStore((s) => s.actions.gitUnsubscribe);
	const status = useWSStore((s) => s.status);

	// Keep callback ref up to date without triggering effect
	const onChangedRef = useRef(onChanged);
	onChangedRef.current = onChanged;

	useEffect(() => {
		if (!enabled || status !== "connected") return;

		let watchId: string | null = null;
		let cancelled = false;

		gitSubscribe(() => {
			onChangedRef.current();
		})
			.then((id) => {
				if (cancelled) {
					// Component unmounted before subscribe completed
					gitUnsubscribe(id);
				} else {
					watchId = id;
				}
			})
			.catch((err) => {
				console.error("Failed to subscribe to git watch:", err);
			});

		return () => {
			cancelled = true;
			if (watchId) {
				gitUnsubscribe(watchId);
			}
		};
	}, [enabled, status, gitSubscribe, gitUnsubscribe]);
}
