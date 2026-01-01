import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock config module
vi.mock("../utils/config", () => ({
	getWebSocketUrl: vi.fn(() => "ws://localhost/ws"),
}));

// Mock authStore
vi.mock("./authStore", () => ({
	authActions: {
		getToken: vi.fn(() => "test-token"),
	},
}));

// Track created WebSocket instances
let mockWsInstances: MockWebSocket[] = [];
let currentMockWs: MockWebSocket | null = null;

// Mock WebSocket as a proper class
class MockWebSocket {
	static OPEN = 1;
	static CLOSED = 3;
	static CONNECTING = 0;
	static CLOSING = 2;

	url: string;
	readyState: number = MockWebSocket.CONNECTING;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;

	send = vi.fn();
	close = vi.fn(() => {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.();
	});

	constructor(url: string) {
		this.url = url;
		mockWsInstances.push(this);
		currentMockWs = this;
	}

	// Test helpers
	simulateOpen() {
		this.readyState = MockWebSocket.OPEN;
		this.onopen?.();
	}
	simulateMessage(data: unknown) {
		this.onmessage?.({ data: JSON.stringify(data) });
	}
	simulateError() {
		this.onerror?.();
	}
	simulateClose() {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.();
	}
}

const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
	vi.useFakeTimers();
	mockWsInstances = [];
	currentMockWs = null;
	globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

afterEach(async () => {
	const { resetWSStore } = await import("./wsStore");
	resetWSStore();

	vi.useRealTimers();
	globalThis.WebSocket = OriginalWebSocket;
});

// Helper to get wsActions
async function getWsActions() {
	const module = await import("./wsStore");
	return module.wsActions;
}

// Helper to get useWSStore for direct state access
async function getUseWSStore() {
	const module = await import("./wsStore");
	return module.useWSStore;
}

// Helper to get the current WebSocket instance
function getMockWs() {
	return currentMockWs;
}

describe("wsStore", () => {
	describe("connect", () => {
		it("sets status to connecting then connected after auth", async () => {
			const wsActions = await getWsActions();
			const useWSStore = await getUseWSStore();
			const statusChanges: string[] = [];

			useWSStore.subscribe((state) => {
				statusChanges.push(state.status);
			});

			wsActions.connect();
			expect(statusChanges).toContain("connecting");

			getMockWs()?.simulateOpen();
			// After open, should still be connecting (waiting for auth_response)
			expect(useWSStore.getState().status).toBe("connecting");

			// Simulate auth_response
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });
			expect(useWSStore.getState().status).toBe("connected");
		});

		it("sends auth message on open", async () => {
			const wsActions = await getWsActions();

			wsActions.connect();
			getMockWs()?.simulateOpen();

			expect(getMockWs()?.send).toHaveBeenCalledWith(
				JSON.stringify({ type: "auth", token: "test-token" }),
			);
		});

		it("sets status to error on auth failure", async () => {
			const wsActions = await getWsActions();
			const useWSStore = await getUseWSStore();

			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({
				type: "auth_response",
				success: false,
				error: "Invalid token",
			});

			expect(useWSStore.getState().status).toBe("error");
		});

		it("sets status to error when no token", async () => {
			const { authActions } = await import("./authStore");
			vi.mocked(authActions.getToken).mockReturnValueOnce("");

			const wsActions = await getWsActions();
			const useWSStore = await getUseWSStore();

			wsActions.connect();

			expect(useWSStore.getState().status).toBe("error");
		});

		it("closes existing connection before creating new one", async () => {
			const wsActions = await getWsActions();

			wsActions.connect();
			const firstWs = getMockWs();
			getMockWs()?.simulateOpen();

			wsActions.connect();
			expect(firstWs?.close).toHaveBeenCalled();
		});

		it("resets reconnect attempts on successful connection", async () => {
			const wsActions = await getWsActions();

			// First connection closes
			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });
			getMockWs()?.simulateClose();

			// Auto-reconnect triggers
			vi.advanceTimersByTime(3000);
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });

			// Should have reset attempts - can reconnect again if needed
			getMockWs()?.simulateClose();
			vi.advanceTimersByTime(3000);
			expect(mockWsInstances.length).toBe(3);
		});
	});

	describe("disconnect", () => {
		it("closes WebSocket and sets status to disconnected", async () => {
			const wsActions = await getWsActions();
			const useWSStore = await getUseWSStore();

			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });
			const ws = getMockWs();

			wsActions.disconnect();

			expect(ws?.close).toHaveBeenCalled();
			expect(useWSStore.getState().status).toBe("disconnected");
		});

		it("cancels pending reconnect", async () => {
			const wsActions = await getWsActions();

			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });
			getMockWs()?.simulateClose();

			// Reconnect scheduled but not yet executed
			wsActions.disconnect();
			vi.advanceTimersByTime(3000);

			// Should not have reconnected
			expect(mockWsInstances.length).toBe(1);
		});
	});

	describe("send", () => {
		it("sends JSON message when connected", async () => {
			const wsActions = await getWsActions();

			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });

			const result = wsActions.send({
				type: "message",
				content: "hello",
				session_id: "test-session",
			});

			expect(result).toBe(true);
			expect(getMockWs()?.send).toHaveBeenCalledWith(
				JSON.stringify({
					type: "message",
					content: "hello",
					session_id: "test-session",
				}),
			);
		});

		it("returns false when not connected", async () => {
			const wsActions = await getWsActions();

			const result = wsActions.send({
				type: "message",
				content: "hello",
				session_id: "test-session",
			});

			expect(result).toBe(false);
		});

		it("returns false when WebSocket not open", async () => {
			const wsActions = await getWsActions();

			wsActions.connect();
			const ws = getMockWs();
			// Don't call simulateOpen - stays in connecting state
			if (ws) {
				ws.readyState = MockWebSocket.CLOSED;
			}

			const result = wsActions.send({
				type: "message",
				content: "hello",
				session_id: "test-session",
			});

			expect(result).toBe(false);
		});
	});

	describe("message handling", () => {
		it("notifies message listeners on valid JSON", async () => {
			const wsActions = await getWsActions();
			const listener = vi.fn();
			wsActions.subscribeMessage(listener);

			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });
			getMockWs()?.simulateMessage({ type: "text", content: "hello" });

			expect(listener).toHaveBeenCalledWith({ type: "text", content: "hello" });
		});

		it("handles invalid JSON gracefully", async () => {
			const wsActions = await getWsActions();
			const listener = vi.fn();
			wsActions.subscribeMessage(listener);

			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });

			// Send raw invalid JSON
			getMockWs()?.onmessage?.({ data: "not json" });

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("subscriptions", () => {
		it("unsubscribe removes listener", async () => {
			const useWSStore = await getUseWSStore();
			const wsActions = await getWsActions();
			const listener = vi.fn();

			const unsubscribe = useWSStore.subscribe(listener);
			wsActions.connect();
			expect(listener).toHaveBeenCalled();

			listener.mockClear();
			unsubscribe();

			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });
			expect(listener).not.toHaveBeenCalled();
		});

		it("multiple listeners all receive updates", async () => {
			const useWSStore = await getUseWSStore();
			const wsActions = await getWsActions();
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			useWSStore.subscribe(listener1);
			useWSStore.subscribe(listener2);

			wsActions.connect();

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
		});
	});

	describe("auto-reconnect", () => {
		it("reconnects up to 5 times on close", async () => {
			const wsActions = await getWsActions();

			wsActions.connect();
			getMockWs()?.simulateOpen();
			getMockWs()?.simulateMessage({ type: "auth_response", success: true });

			// Trigger 5 reconnects
			for (let i = 0; i < 5; i++) {
				getMockWs()?.simulateClose();
				vi.advanceTimersByTime(3000);
			}

			// Should have connected 6 times total (1 initial + 5 reconnects)
			expect(mockWsInstances.length).toBe(6);

			// 6th close should not trigger reconnect
			getMockWs()?.simulateClose();
			vi.advanceTimersByTime(3000);
			expect(mockWsInstances.length).toBe(6);
		});

		it("sets status to error on socket error", async () => {
			const wsActions = await getWsActions();
			const useWSStore = await getUseWSStore();

			wsActions.connect();
			getMockWs()?.simulateError();

			expect(useWSStore.getState().status).toBe("error");
		});
	});
});
