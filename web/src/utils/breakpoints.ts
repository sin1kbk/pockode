// Tailwind sm breakpoint
const SM_BREAKPOINT = 640;

export function isMobile(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia(`(max-width: ${SM_BREAKPOINT - 1}px)`).matches;
}
