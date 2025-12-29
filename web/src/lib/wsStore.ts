import { create } from "zustand";
import type { WSClientMessage, WSServerMessage } from "../types/message";
import { getWebSocketUrl } from "../utils/config";
import { authActions } from "./authStore";

export type ConnectionStatus =
	| "connecting"
	| "connected"
	| "disconnected"
	| "error";

type MessageListener = (message: WSServerMessage) => void;

interface WSState {
	status: ConnectionStatus;
	connect: () => void;
	disconnect: () => void;
	send: (message: WSClientMessage) => boolean;
	subscribeMessage: (listener: MessageListener) => () => void;
}

// Module-level state for mutable objects (not reactive)
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: number | undefined;
const messageListeners = new Set<MessageListener>();

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 3000;

export const useWSStore = create<WSState>((set, get) => ({
	status: "disconnected",

	connect: () => {
		const token = authActions.getToken();
		if (!token) {
			set({ status: "error" });
			return;
		}

		// Close existing connection
		if (ws) {
			ws.close();
			ws = null;
		}

		set({ status: "connecting" });

		const url = `${getWebSocketUrl()}?token=${encodeURIComponent(token)}`;
		const socket = new WebSocket(url);

		socket.onopen = () => {
			set({ status: "connected" });
			reconnectAttempts = 0;
		};

		socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as WSServerMessage;
				for (const listener of messageListeners) {
					listener(data);
				}
			} catch (e) {
				console.warn("Failed to parse WebSocket message:", event.data, e);
			}
		};

		socket.onerror = () => {
			set({ status: "error" });
		};

		socket.onclose = () => {
			set({ status: "disconnected" });
			ws = null;

			// Auto reconnect
			if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
				reconnectAttempts += 1;
				reconnectTimeout = window.setTimeout(() => {
					get().connect();
				}, RECONNECT_INTERVAL);
			}
		};

		ws = socket;
	},

	disconnect: () => {
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = undefined;
		}
		reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
		if (ws) {
			ws.close();
			ws = null;
		}
		set({ status: "disconnected" });
	},

	send: (message) => {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
			return true;
		}
		console.warn("WebSocket is not connected, message not sent:", message);
		return false;
	},

	subscribeMessage: (listener) => {
		messageListeners.add(listener);
		return () => {
			messageListeners.delete(listener);
		};
	},
}));

// Compatibility layer for non-hook usage (e.g., App.tsx logout)
export const wsStore = {
	get status() {
		return useWSStore.getState().status;
	},
	connect: () => useWSStore.getState().connect(),
	disconnect: () => useWSStore.getState().disconnect(),
	send: (message: WSClientMessage) => useWSStore.getState().send(message),
	subscribeMessage: (listener: MessageListener) =>
		useWSStore.getState().subscribeMessage(listener),
	// For useSyncExternalStore compatibility (can be removed after full migration)
	subscribeStatus: (listener: () => void) => {
		return useWSStore.subscribe((state, prevState) => {
			if (state.status !== prevState.status) {
				listener();
			}
		});
	},
	getStatusSnapshot: () => useWSStore.getState().status,
};

// Reset function for testing
export function resetWSStore() {
	if (ws) {
		ws.close();
		ws = null;
	}
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = undefined;
	}
	reconnectAttempts = 0;
	messageListeners.clear();
	useWSStore.setState({ status: "disconnected" });
}
