import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./wsStore", () => ({
	wsStore: {
		disconnect: vi.fn(),
	},
}));

describe("authStore", () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("initial state", () => {
		it("token is set when it exists in storage", async () => {
			localStorage.setItem("auth_token", "test-token");

			const { useAuthStore } = await import("./authStore");
			expect(useAuthStore.getState().token).toBe("test-token");
		});

		it("token is null when no token in storage", async () => {
			const { useAuthStore } = await import("./authStore");
			expect(useAuthStore.getState().token).toBeNull();
		});
	});

	describe("authActions", () => {
		it("login saves token to storage and state", async () => {
			const { useAuthStore, authActions } = await import("./authStore");

			authActions.login("new-token");

			expect(localStorage.getItem("auth_token")).toBe("new-token");
			expect(useAuthStore.getState().token).toBe("new-token");
		});

		it("logout disconnects wsStore, clears token from storage and state", async () => {
			const { wsStore } = await import("./wsStore");
			const { useAuthStore, authActions } = await import("./authStore");

			authActions.login("token");
			authActions.logout();

			expect(wsStore.disconnect).toHaveBeenCalled();
			expect(localStorage.getItem("auth_token")).toBeNull();
			expect(useAuthStore.getState().token).toBeNull();
		});

		it("getToken returns current token", async () => {
			const { authActions } = await import("./authStore");

			authActions.login("my-token");
			expect(authActions.getToken()).toBe("my-token");

			authActions.logout();
			expect(authActions.getToken()).toBe("");
		});
	});
});
