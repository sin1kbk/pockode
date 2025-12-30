import { useCallback, useEffect, useState } from "react";
import {
	applyServerEvent,
	normalizeEvent,
	replayHistory,
} from "../lib/messageReducer";
import { getHistory } from "../lib/sessionApi";
import type {
	AssistantMessage,
	Message,
	PermissionStatus,
	UserMessage,
	WSClientMessage,
	WSServerMessage,
} from "../types/message";
import { generateUUID } from "../utils/uuid";
import { type ConnectionStatus, useWebSocket } from "./useWebSocket";

export type { ConnectionStatus };

interface UseChatMessagesOptions {
	sessionId: string;
	onServerMessage?: (msg: WSServerMessage) => void;
}

interface UseChatMessagesReturn {
	messages: Message[];
	isLoadingHistory: boolean;
	isStreaming: boolean;
	isProcessRunning: boolean;
	status: ConnectionStatus;
	send: (msg: WSClientMessage) => boolean;
	sendUserMessage: (content: string) => boolean;
	updatePermissionStatus: (requestId: string, status: PermissionStatus) => void;
}

export function useChatMessages({
	sessionId,
	onServerMessage,
}: UseChatMessagesOptions): UseChatMessagesReturn {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [isProcessRunning, setIsProcessRunning] = useState(false);

	const handleServerMessage = useCallback(
		(serverMsg: WSServerMessage) => {
			if (serverMsg.session_id && serverMsg.session_id !== sessionId) {
				return;
			}

			if (serverMsg.type === "attach_response") {
				setIsProcessRunning(serverMsg.process_running);
				return;
			}

			// Update process running state
			if (serverMsg.type === "process_ended") {
				setIsProcessRunning(false);
			} else {
				// Any event from process means it's running
				setIsProcessRunning(true);
			}

			// Delegate ask_user_question to parent (keeps dialog pattern)
			if (serverMsg.type === "ask_user_question") {
				onServerMessage?.(serverMsg);
				return;
			}

			// permission_request is now handled via messageReducer
			const event = normalizeEvent(serverMsg);
			setMessages((prev) => applyServerEvent(prev, event));
		},
		[sessionId, onServerMessage],
	);

	const { status, send } = useWebSocket({
		onMessage: handleServerMessage,
	});

	// Attach to session when connected (enables receiving events without sending a message)
	useEffect(() => {
		if (status === "connected") {
			send({ type: "attach", session_id: sessionId });
		}
	}, [status, sessionId, send]);

	useEffect(() => {
		setMessages([]);
		setIsProcessRunning(false);

		async function loadHistory() {
			setIsLoadingHistory(true);
			try {
				const history = await getHistory(sessionId);
				const replayedMessages = replayHistory(history);
				setMessages(replayedMessages);
			} catch (err) {
				console.error("Failed to load history:", err);
			} finally {
				setIsLoadingHistory(false);
			}
		}

		loadHistory();
	}, [sessionId]);

	const sendUserMessage = useCallback(
		(content: string): boolean => {
			const userMessageId = generateUUID();
			const assistantMessageId = generateUUID();

			const userMessage: UserMessage = {
				id: userMessageId,
				role: "user",
				content,
				status: "complete",
				createdAt: new Date(),
			};

			// Empty assistant message ready to receive streaming content
			const assistantMessage: AssistantMessage = {
				id: assistantMessageId,
				role: "assistant",
				parts: [],
				status: "sending",
				createdAt: new Date(),
			};

			setMessages((prev) => [...prev, userMessage, assistantMessage]);

			const sent = send({
				type: "message",
				content,
				session_id: sessionId,
			});

			if (!sent) {
				setMessages((prev) =>
					prev.map((m): Message => {
						if (m.role === "assistant" && m.id === assistantMessageId) {
							return { ...m, status: "error", error: "Failed to send message" };
						}
						return m;
					}),
				);
			}

			return sent;
		},
		[send, sessionId],
	);

	const updatePermissionStatus = useCallback(
		(requestId: string, newStatus: PermissionStatus) => {
			setMessages((prev) =>
				prev.map((msg): Message => {
					if (msg.role !== "assistant") return msg;
					return {
						...msg,
						parts: msg.parts.map((part) => {
							if (
								part.type === "permission_request" &&
								part.request.requestId === requestId
							) {
								return { ...part, status: newStatus };
							}
							return part;
						}),
					};
				}),
			);
		},
		[],
	);

	// isStreaming controls input blocking
	// - sending: always block (waiting for server response)
	// - streaming: only block when process is running
	const last = messages[messages.length - 1];
	const lastIsSending = last?.role === "assistant" && last.status === "sending";
	const lastIsStreaming =
		last?.role === "assistant" && last.status === "streaming";
	const isStreaming = lastIsSending || (lastIsStreaming && isProcessRunning);

	return {
		messages,
		isLoadingHistory,
		isStreaming,
		isProcessRunning,
		status,
		send,
		sendUserMessage,
		updatePermissionStatus,
	};
}
