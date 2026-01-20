import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	SessionListChangedNotification,
	SessionMeta,
} from "../types/message";
import { useSession, useSessionStore } from "./useSession";

const mockSession = (id: string, title = "Test Session"): SessionMeta => ({
	id,
	title,
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
});

let sessionListCallback:
	| ((params: SessionListChangedNotification) => void)
	| null = null;
let mockSessions: SessionMeta[] = [];
let mockStatus = "connected";

const mockSessionListSubscribe = vi.fn(
	async (callback: (params: SessionListChangedNotification) => void) => {
		sessionListCallback = callback;
		return { id: "watch-1", sessions: mockSessions };
	},
);
const mockSessionListUnsubscribe = vi.fn();

vi.mock("../lib/wsStore", () => ({
	useWSStore: vi.fn((selector) => {
		const state = {
			status: mockStatus,
			projectTitle: "test",
			workDir: "/test",
			actions: {
				sessionListSubscribe: mockSessionListSubscribe,
				sessionListUnsubscribe: mockSessionListUnsubscribe,
			},
		};
		return selector(state);
	}),
	setSessionExistsChecker: vi.fn(),
	wsActions: {
		createSession: vi.fn(),
		deleteSession: vi.fn(),
		updateSessionTitle: vi.fn(),
	},
}));

vi.mock("../lib/sessionApi", () => ({
	createSession: vi.fn(),
	deleteSession: vi.fn(),
	updateSessionTitle: vi.fn(),
}));

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

describe("useSession", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = createTestQueryClient();
		vi.clearAllMocks();
		sessionListCallback = null;
		mockSessions = [];
		mockStatus = "connected";
		useSessionStore.setState({ sessions: [], isLoading: true, isSuccess: false });
	});

	afterEach(() => {
		queryClient.clear();
	});

	describe("initial load", () => {
		it("loads sessions via subscribe", async () => {
			mockSessions = [mockSession("1"), mockSession("2")];

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions).toEqual(mockSessions);
			});
		});

		it("does not load when disabled", async () => {
			mockSessions = [mockSession("1")];

			const { result } = renderHook(() => useSession({ enabled: false }), {
				wrapper: createWrapper(queryClient),
			});

			await new Promise((r) => setTimeout(r, 50));

			expect(mockSessionListSubscribe).not.toHaveBeenCalled();
			expect(result.current.sessions).toEqual([]);
		});

		it("does not load when WebSocket is disconnected", async () => {
			mockStatus = "disconnected";
			mockSessions = [mockSession("1")];

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await new Promise((r) => setTimeout(r, 50));

			expect(mockSessionListSubscribe).not.toHaveBeenCalled();
			expect(result.current.sessions).toEqual([]);
		});

		it("sets isLoading to false after successful load", async () => {
			mockSessions = [mockSession("1")];

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
				expect(result.current.isSuccess).toBe(true);
			});
		});
	});

	describe("redirectSessionId", () => {
		it("redirects when no routeSessionId provided", async () => {
			mockSessions = [mockSession("1"), mockSession("2")];

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.redirectSessionId).toBe("1");
		});

		it("does not redirect when routeSessionId is valid", async () => {
			mockSessions = [mockSession("1"), mockSession("2")];

			const { result } = renderHook(() => useSession({ routeSessionId: "2" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.redirectSessionId).toBeNull();
		});

		it("redirects to first session when routeSessionId is invalid", async () => {
			mockSessions = [mockSession("1"), mockSession("2")];

			const { result } = renderHook(
				() => useSession({ routeSessionId: "invalid" }),
				{ wrapper: createWrapper(queryClient) },
			);

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.redirectSessionId).toBe("1");
		});
	});

	describe("needsNewSession", () => {
		it("is true when session list is empty", async () => {
			mockSessions = [];

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.needsNewSession).toBe(true);
		});

		it("is false when sessions exist", async () => {
			mockSessions = [mockSession("1")];

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.needsNewSession).toBe(false);
		});
	});

	describe("notification handling", () => {
		it("handles create notification", async () => {
			mockSessions = [mockSession("1")];

			const { result } = renderHook(() => useSession({ routeSessionId: "1" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
			});

			// Simulate server notification
			act(() => {
				sessionListCallback?.({
					id: "watch-1",
					operation: "create",
					session: mockSession("new-id"),
				});
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(2);
			});
			expect(result.current.sessions[0].id).toBe("new-id");
		});

		it("handles delete notification", async () => {
			mockSessions = [mockSession("1"), mockSession("2")];

			const { result } = renderHook(() => useSession({ routeSessionId: "1" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(2);
			});

			// Simulate server notification
			act(() => {
				sessionListCallback?.({
					id: "watch-1",
					operation: "delete",
					sessionId: "2",
				});
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
			});
			expect(result.current.sessions[0].id).toBe("1");
		});

		it("handles update notification", async () => {
			mockSessions = [mockSession("1", "Old Title")];

			const { result } = renderHook(() => useSession({ routeSessionId: "1" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions[0].title).toBe("Old Title");
			});

			// Simulate server notification
			act(() => {
				sessionListCallback?.({
					id: "watch-1",
					operation: "update",
					session: mockSession("1", "New Title"),
				});
			});

			await waitFor(() => {
				expect(result.current.sessions[0].title).toBe("New Title");
			});
		});
	});

	describe("currentSession", () => {
		it("matches routeSessionId", async () => {
			mockSessions = [mockSession("1", "First"), mockSession("2", "Second")];

			const { result } = renderHook(() => useSession({ routeSessionId: "2" }), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.currentSession?.title).toBe("Second");
			});
		});

		it("is undefined when routeSessionId is invalid", async () => {
			mockSessions = [mockSession("1", "First")];

			const { result } = renderHook(
				() => useSession({ routeSessionId: "invalid" }),
				{ wrapper: createWrapper(queryClient) },
			);

			await waitFor(() => {
				expect(result.current.isSuccess).toBe(true);
			});

			expect(result.current.currentSession).toBeUndefined();
		});
	});

	describe("cleanup", () => {
		it("unsubscribes on unmount", async () => {
			mockSessions = [mockSession("1")];

			const { unmount } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(mockSessionListSubscribe).toHaveBeenCalled();
			});

			unmount();

			expect(mockSessionListUnsubscribe).toHaveBeenCalledWith("watch-1");
		});
	});

	describe("idempotency", () => {
		it("does not duplicate session on repeated create notification", async () => {
			mockSessions = [mockSession("1")];

			const { result } = renderHook(() => useSession(), {
				wrapper: createWrapper(queryClient),
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
			});

			act(() => {
				sessionListCallback?.({
					id: "watch-1",
					operation: "create",
					session: mockSession("1", "Updated"),
				});
			});

			await waitFor(() => {
				expect(result.current.sessions.length).toBe(1);
				expect(result.current.sessions[0].title).toBe("Updated");
			});
		});
	});

	describe("current session deleted", () => {
		it("sets redirectSessionId when current session is deleted", async () => {
			mockSessions = [mockSession("1"), mockSession("2")];

			const { result } = renderHook(
				() => useSession({ routeSessionId: "1" }),
				{ wrapper: createWrapper(queryClient) },
			);

			await waitFor(() => {
				expect(result.current.currentSession?.id).toBe("1");
			});

			// Delete current session
			act(() => {
				sessionListCallback?.({
					id: "watch-1",
					operation: "delete",
					sessionId: "1",
				});
			});

			await waitFor(() => {
				expect(result.current.currentSession).toBeUndefined();
				expect(result.current.redirectSessionId).toBe("2");
			});
		});
	});
});
