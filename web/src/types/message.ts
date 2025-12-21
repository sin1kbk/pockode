// Message role
export type MessageRole = "user" | "assistant";

// Message status
export type MessageStatus = "sending" | "streaming" | "complete" | "error";

// Tool call
export interface ToolCall {
	id?: string;
	name: string;
	input: unknown;
	result?: string;
}

// Chat message
export interface Message {
	id: string;
	role: MessageRole;
	content: string;
	status: MessageStatus;
	toolCalls?: ToolCall[];
	error?: string;
	createdAt: Date;
}

// Permission request
export interface PermissionRequest {
	requestId: string;
	toolName: string;
	toolInput: unknown;
	toolUseId?: string;
}

// WebSocket client message
export type WSClientMessage =
	| {
			type: "message";
			id: string;
			content: string;
			session_id?: string;
	  }
	| {
			type: "cancel";
			id: string;
			session_id?: string;
	  }
	| {
			type: "permission_response";
			session_id: string;
			request_id: string;
			allow: boolean;
	  };

// WebSocket server message
export interface WSServerMessage {
	type:
		| "text"
		| "tool_call"
		| "tool_result"
		| "error"
		| "done"
		| "session"
		| "permission_request";
	content?: string;
	tool_name?: string;
	tool_input?: unknown;
	tool_use_id?: string;
	tool_result?: string;
	error?: string;
	session_id?: string;
	request_id?: string;
}
