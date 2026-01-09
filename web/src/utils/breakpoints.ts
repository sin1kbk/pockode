// Tailwind sm breakpoint
const SM_BREAKPOINT = 640;

export function isMobile(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia(`(max-width: ${SM_BREAKPOINT - 1}px)`).matches;
}

/** Use when PC users need the feature even in narrow windows (e.g. keyboard shortcuts). */
export function hasCoarsePointer(): boolean {
	if (typeof window === "undefined") return true;
	return window.matchMedia("(pointer: coarse)").matches;
}
