import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("themeStore", () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
		document.documentElement.className = "";
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("initial state", () => {
		it("uses stored mode when valid", async () => {
			localStorage.setItem("theme-mode", "dark");

			const { useThemeStore } = await import("./themeStore");
			expect(useThemeStore.getState().mode).toBe("dark");
		});

		it("defaults to system mode when no stored value", async () => {
			const { useThemeStore } = await import("./themeStore");
			expect(useThemeStore.getState().mode).toBe("system");
		});

		it("defaults to system mode when stored value is invalid", async () => {
			localStorage.setItem("theme-mode", "invalid");

			const { useThemeStore } = await import("./themeStore");
			expect(useThemeStore.getState().mode).toBe("system");
		});

		it("uses stored theme when valid", async () => {
			localStorage.setItem("theme-name", "aurora");

			const { useThemeStore } = await import("./themeStore");
			expect(useThemeStore.getState().theme).toBe("aurora");
		});

		it("defaults to abyss theme when no stored value", async () => {
			const { useThemeStore } = await import("./themeStore");
			expect(useThemeStore.getState().theme).toBe("abyss");
		});

		it("defaults to abyss theme when stored value is invalid", async () => {
			localStorage.setItem("theme-name", "invalid");

			const { useThemeStore } = await import("./themeStore");
			expect(useThemeStore.getState().theme).toBe("abyss");
		});
	});

	describe("themeActions.setMode", () => {
		it("updates mode in storage and state", async () => {
			const { useThemeStore, themeActions } = await import("./themeStore");

			themeActions.setMode("dark");

			expect(localStorage.getItem("theme-mode")).toBe("dark");
			expect(useThemeStore.getState().mode).toBe("dark");
		});

		it("applies dark class to DOM when mode is dark", async () => {
			const { themeActions } = await import("./themeStore");

			themeActions.setMode("dark");

			expect(document.documentElement.classList.contains("dark")).toBe(true);
		});

		it("removes dark class from DOM when mode is light", async () => {
			const { themeActions } = await import("./themeStore");

			themeActions.setMode("dark");
			themeActions.setMode("light");

			expect(document.documentElement.classList.contains("dark")).toBe(false);
		});

		it("updates resolvedMode based on mode", async () => {
			const { useThemeStore, themeActions } = await import("./themeStore");

			themeActions.setMode("dark");
			expect(useThemeStore.getState().resolvedMode).toBe("dark");

			themeActions.setMode("light");
			expect(useThemeStore.getState().resolvedMode).toBe("light");
		});
	});

	describe("themeActions.setTheme", () => {
		it("updates theme in storage and state", async () => {
			const { useThemeStore, themeActions } = await import("./themeStore");

			themeActions.setTheme("ember");

			expect(localStorage.getItem("theme-name")).toBe("ember");
			expect(useThemeStore.getState().theme).toBe("ember");
		});

		it("applies theme class to DOM", async () => {
			const { themeActions } = await import("./themeStore");

			themeActions.setTheme("mint");

			expect(document.documentElement.classList.contains("theme-mint")).toBe(
				true,
			);
		});

		it("removes previous theme class when switching", async () => {
			const { themeActions } = await import("./themeStore");

			themeActions.setTheme("aurora");
			themeActions.setTheme("void");

			expect(document.documentElement.classList.contains("theme-aurora")).toBe(
				false,
			);
			expect(document.documentElement.classList.contains("theme-void")).toBe(
				true,
			);
		});
	});

	describe("themeActions.init", () => {
		it("applies stored theme to DOM on init", async () => {
			localStorage.setItem("theme-mode", "dark");
			localStorage.setItem("theme-name", "ember");

			const { themeActions } = await import("./themeStore");
			themeActions.init();

			expect(document.documentElement.classList.contains("dark")).toBe(true);
			expect(document.documentElement.classList.contains("theme-ember")).toBe(
				true,
			);
		});
	});
});
