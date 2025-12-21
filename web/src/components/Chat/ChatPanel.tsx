import { useCallback, useState } from "react";
import { type ConnectionStatus, useWebSocket } from "../../hooks/useWebSocket";
import type {
	Message,
	PermissionRequest,
	WSServerMessage,
} from "../../types/message";
import { generateUUID } from "../../utils/uuid";
import InputBar from "./InputBar";
import MessageList from "./MessageList";
import PermissionDialog from "./PermissionDialog";

const STATUS_CONFIG: Record<ConnectionStatus, { text: string; color: string }> =
	{
		connected: { text: "Connected", color: "text-green-400" },
		error: { text: "Connection Error", color: "text-red-400" },
		disconnected: { text: "Disconnected", color: "text-yellow-400" },
		connecting: { text: "Connecting...", color: "text-yellow-400" },
	};

function ChatPanel() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [permissionRequest, setPermissionRequest] =
		useState<PermissionRequest | null>(null);

	const handleServerMessage = useCallback((serverMsg: WSServerMessage) => {
		// Handle session event
		if (serverMsg.type === "session" && serverMsg.session_id) {
			setSessionId(serverMsg.session_id);
			return;
		}

		// Handle permission request
		if (serverMsg.type === "permission_request") {
			setPermissionRequest({
				requestId: serverMsg.request_id ?? "",
				toolName: serverMsg.tool_name ?? "",
				toolInput: serverMsg.tool_input,
				toolUseId: serverMsg.tool_use_id,
			});
			return;
		}

		setMessages((prev) => {
			// Find the current pending message (sending or streaming)
			const index = prev.findIndex(
				(m) => m.status === "sending" || m.status === "streaming",
			);
			if (index === -1) return prev;

			const updated = [...prev];
			const message = { ...updated[index] };

			switch (serverMsg.type) {
				case "text":
					message.content += serverMsg.content ?? "";
					message.status = "streaming";
					break;
				case "tool_call":
					message.toolCalls = [
						...(message.toolCalls ?? []),
						{
							id: serverMsg.tool_use_id,
							name: serverMsg.tool_name ?? "",
							input: serverMsg.tool_input,
						},
					];
					break;
				case "tool_result":
					// Match tool result to tool call by id
					if (message.toolCalls && serverMsg.tool_use_id) {
						message.toolCalls = message.toolCalls.map((tc) =>
							tc.id === serverMsg.tool_use_id
								? { ...tc, result: serverMsg.tool_result }
								: tc,
						);
					}
					break;
				case "done":
					message.status = "complete";
					break;
				case "error":
					message.status = "error";
					message.error = serverMsg.error;
					break;
			}

			updated[index] = message;
			return updated;
		});
	}, []);

	const { status, send } = useWebSocket({
		onMessage: handleServerMessage,
	});

	const handleSend = useCallback(
		(content: string) => {
			const userMessageId = generateUUID();
			const assistantMessageId = generateUUID();

			// Add user message
			const userMessage: Message = {
				id: userMessageId,
				role: "user",
				content,
				status: "complete",
				createdAt: new Date(),
			};

			// Add empty AI message (ready to receive streaming content)
			const assistantMessage: Message = {
				id: assistantMessageId,
				role: "assistant",
				content: "",
				status: "sending",
				createdAt: new Date(),
			};

			setMessages((prev) => [...prev, userMessage, assistantMessage]);

			// Send to server with session_id if available
			const sent = send({
				type: "message",
				id: assistantMessageId,
				content,
				session_id: sessionId ?? undefined,
			});

			// Handle send failure
			if (!sent) {
				setMessages((prev) =>
					prev.map((m) =>
						m.id === assistantMessageId
							? { ...m, status: "error", error: "Failed to send message" }
							: m,
					),
				);
			}
		},
		[send, sessionId],
	);

	const handlePermissionResponse = useCallback(
		(allow: boolean) => {
			if (!permissionRequest || !sessionId) return;

			send({
				type: "permission_response",
				session_id: sessionId,
				request_id: permissionRequest.requestId,
				allow,
			});

			setPermissionRequest(null);
		},
		[send, permissionRequest, sessionId],
	);

	const { text: statusText, color: statusColor } = STATUS_CONFIG[status];

	return (
		<div className="flex h-screen flex-col bg-gray-900">
			<header className="flex items-center justify-between border-b border-gray-700 p-4">
				<h1 className="text-xl font-bold text-white">Pockode</h1>
				<span className={`text-sm ${statusColor}`}>{statusText}</span>
			</header>
			<MessageList messages={messages} />
			<InputBar onSend={handleSend} disabled={status !== "connected"} />

			{permissionRequest && (
				<PermissionDialog
					request={permissionRequest}
					onAllow={() => handlePermissionResponse(true)}
					onDeny={() => handlePermissionResponse(false)}
				/>
			)}
		</div>
	);
}

export default ChatPanel;
