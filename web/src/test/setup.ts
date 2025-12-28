import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Mock window.matchMedia for theme detection
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: (query: string) => ({
		matches: query === "(prefers-color-scheme: dark)",
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => true,
	}),
});

afterEach(() => {
	cleanup();
});
