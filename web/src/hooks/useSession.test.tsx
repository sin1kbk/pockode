import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionMeta } from "../types/message";
import { useSession } from "./useSession";

vi.mock("../lib/sessionApi", () => ({
	listSessions: vi.fn(),
	createSession: vi.fn(),
	deleteSession: vi.fn(),
	updateSessionTitle: vi.fn(),
}));

// Mock useWSStore to return connected status by default
vi.mock("../lib/wsStore", () => ({
	useWSStore: vi.fn((selector) => {
		const state = { status: "connected" };
		return selector(state);
	}),
}));

import * as sessionApi from "../lib/sessionApi";
import { useWSStore } from "../lib/wsStore";

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
}

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

const mockSession = (id: string, title = "Test Session"): SessionMeta => ({
	id,
	title,
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
});

describe("useSession", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = createTestQueryClient();
		vi.clearAllMocks();
		// Reset useWSStore mock to connected status
		vi.mocked(useWSStore).mockImplementation((selector) => {
			const state = { status: "connected" };
			return selector(state);
		});
	});

	afterEach(() => {
		queryClient.clear();
	});

	describe("initial load", () => {
		it("loads sessions", async () => {
			const sessions = [mockSession("1"), mockSession("2")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions).toEqual(sessions);
			});
		});

		it("does not load when disabled", async () => {
			vi.mocked(sessionApi.listSessions).mockResolvedValue([]);

			const { result } = renderHook(() => useSession({ enabled: false }), {
				wrapper: createWrapper(queryClient),
			});

			await new Promise((r) => setTimeout(r, 50));

			expect(result.current.isLoading).toBe(false);
			expect(sessionApi.listSessions).not.toHaveBeenCalled();
		});

		it("does not load when WebSocket is disconnected", async () => {
			vi.mocked(useWSStore).mockImplementation((selector) => {
				const state = { status: "disconnected" };
				return selector(state);
			});

			vi.mocked(sessionApi.listSessions).mockResolvedValue([]);

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await new Promise((r) => setTimeout(r, 50));

			expect(result.current.isLoading).toBe(false);
			expect(sessionApi.listSessions).not.toHaveBeenCalled();
		});
	});

	describe("redirectSessionId", () => {
		it("redirects when no routeSessionId provided", async () => {
			const sessions = [mockSession("1"), mockSession("2")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.redirectSessionId).toBe("1");
		});

		it("redirects when routeSessionId is invalid", async () => {
			const sessions = [mockSession("1"), mockSession("2")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);

			const { result } = renderHook(
				() => useSession({ routeSessionId: "invalid-id" }),
				{ wrapper: createWrapper(queryClient) },
			);

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.redirectSessionId).toBe("1");
		});

		it("does not redirect when routeSessionId is valid", async () => {
			const sessions = [mockSession("1"), mockSession("2")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);

			const { result } = renderHook(() => useSession({ routeSessionId: "2" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.redirectSessionId).toBeNull();
		});
	});

	describe("needsNewSession", () => {
		it("is true when session list is empty", async () => {
			vi.mocked(sessionApi.listSessions).mockResolvedValue([]);

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.needsNewSession).toBe(true);
		});

		it("is false when sessions exist", async () => {
			vi.mocked(sessionApi.listSessions).mockResolvedValue([mockSession("1")]);

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.needsNewSession).toBe(false);
		});
	});

	describe("createSession", () => {
		it("adds new session to cache", async () => {
			vi.mocked(sessionApi.listSessions).mockResolvedValue([mockSession("1")]);
			vi.mocked(sessionApi.createSession).mockResolvedValue(
				mockSession("new-id"),
			);

			const { result } = renderHook(() => useSession({ routeSessionId: "1" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
			});

			await act(async () => {
				await result.current.createSession();
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(2);
			});
			expect(result.current.sessions[0].id).toBe("new-id");
		});
	});

	describe("deleteSession", () => {
		it("removes session from cache", async () => {
			const sessions = [mockSession("1"), mockSession("2")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);
			vi.mocked(sessionApi.deleteSession).mockResolvedValue(undefined);

			const { result } = renderHook(() => useSession({ routeSessionId: "1" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(2);
			});

			await act(async () => {
				await result.current.deleteSession("2");
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
			});
			expect(result.current.sessions[0].id).toBe("1");
		});
	});

	describe("updateTitle", () => {
		it("updates session title in cache", async () => {
			vi.mocked(sessionApi.listSessions).mockResolvedValue([
				mockSession("1", "Old Title"),
			]);
			vi.mocked(sessionApi.updateSessionTitle).mockResolvedValue(undefined);

			const { result } = renderHook(() => useSession({ routeSessionId: "1" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
			});

			result.current.updateTitle("1", "New Title");

			await waitFor(() => {
				expect(result.current.sessions[0].title).toBe("New Title");
			});
		});

		it("refreshes sessions list on error", async () => {
			vi.mocked(sessionApi.listSessions).mockResolvedValue([
				mockSession("1", "Title"),
			]);
			vi.mocked(sessionApi.updateSessionTitle).mockRejectedValue(
				new Error("HTTP 404: Not Found"),
			);

			const { result } = renderHook(() => useSession({ routeSessionId: "1" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
			});

			vi.mocked(sessionApi.listSessions).mockClear();

			result.current.updateTitle("1", "New Title");

			await waitFor(() => {
				expect(sessionApi.listSessions).toHaveBeenCalled();
			});
		});
	});

	describe("currentSession", () => {
		it("matches routeSessionId", async () => {
			const sessions = [mockSession("1", "First"), mockSession("2", "Second")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);

			const { result } = renderHook(() => useSession({ routeSessionId: "2" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.currentSession?.title).toBe("Second");
			});
		});

		it("is undefined when routeSessionId is invalid", async () => {
			const sessions = [mockSession("1", "First")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);

			const { result } = renderHook(
				() => useSession({ routeSessionId: "invalid" }),
				{ wrapper: createWrapper(queryClient) },
			);

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.currentSession).toBeUndefined();
		});

		it("updates when route changes", async () => {
			const sessions = [mockSession("1"), mockSession("2"), mockSession("3")];
			vi.mocked(sessionApi.listSessions).mockResolvedValue(sessions);

			const { result, rerender } = renderHook(
				({ routeSessionId }) => useSession({ routeSessionId }),
				{
					wrapper: createWrapper(queryClient),
					initialProps: { routeSessionId: "2" as string | undefined },
				},
			);

			await waitFor(() => {
				expect(result.current.currentSessionId).toBe("2");
			});

			rerender({ routeSessionId: "3" });

			expect(result.current.currentSessionId).toBe("3");
		});
	});
});
