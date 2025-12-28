import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function getSystemTheme(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function applyTheme(mode: ThemeMode) {
	const resolvedTheme = mode === "system" ? getSystemTheme() : mode;
	document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
}

export function useTheme() {
	const [mode, setModeState] = useState<ThemeMode>(() => {
		if (typeof window === "undefined") return "system";
		return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "system";
	});

	const setMode = useCallback((newMode: ThemeMode) => {
		setModeState(newMode);
		localStorage.setItem(STORAGE_KEY, newMode);
		applyTheme(newMode);
	}, []);

	// Apply theme on mount and when mode changes
	useEffect(() => {
		applyTheme(mode);
	}, [mode]);

	// Listen to system preference changes when in "system" mode
	useEffect(() => {
		if (mode !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => applyTheme("system");

		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, [mode]);

	const resolvedTheme = mode === "system" ? getSystemTheme() : mode;

	return { mode, setMode, resolvedTheme };
}
