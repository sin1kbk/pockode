import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WSServerMessage } from "../../types/message";
import ChatPanel from "./ChatPanel";

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock state - stored in module scope for vi.mock factory access
const mockState = {
	send: vi.fn(() => true),
	onMessage: null as ((message: WSServerMessage) => void) | null,
	uuidCounter: 0,
};

vi.mock("../../hooks/useWebSocket", () => ({
	useWebSocket: (options: { onMessage: (msg: WSServerMessage) => void }) => {
		mockState.onMessage = options.onMessage;
		return {
			status: "connected",
			send: mockState.send,
			disconnect: vi.fn(),
		};
	},
}));

vi.mock("../../utils/uuid", () => ({
	generateUUID: () => `uuid-${++mockState.uuidCounter}`,
}));

describe("ChatPanel", () => {
	const defaultProps = {
		sessionId: "test-session",
		sessionTitle: "Test Chat",
		onUpdateTitle: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockState.send.mockReturnValue(true);
		mockState.onMessage = null;
		mockState.uuidCounter = 0;
	});

	describe("sending messages", () => {
		it("sends message to WebSocket with session_id", async () => {
			const user = userEvent.setup();
			render(<ChatPanel {...defaultProps} />);

			const textarea = screen.getByPlaceholderText("Type a message...");
			await user.type(textarea, "Hello AI");
			await user.click(screen.getByRole("button", { name: "Send" }));

			expect(mockState.send).toHaveBeenCalledWith({
				type: "message",
				content: "Hello AI",
				session_id: "test-session",
			});
			expect(screen.getByText("Hello AI")).toBeInTheDocument();
		});

		it("updates title on first message when title is 'New Chat'", async () => {
			const user = userEvent.setup();
			const onUpdateTitle = vi.fn();
			render(
				<ChatPanel
					{...defaultProps}
					sessionTitle="New Chat"
					onUpdateTitle={onUpdateTitle}
				/>,
			);

			const textarea = screen.getByPlaceholderText("Type a message...");
			await user.type(textarea, "My first message");
			await user.click(screen.getByRole("button", { name: "Send" }));

			expect(onUpdateTitle).toHaveBeenCalledWith("My first message");
		});

		it("shows error when send fails", async () => {
			mockState.send.mockReturnValueOnce(false);
			const user = userEvent.setup();
			render(<ChatPanel {...defaultProps} />);

			const textarea = screen.getByPlaceholderText("Type a message...");
			await user.type(textarea, "Hello");
			await user.click(screen.getByRole("button", { name: "Send" }));

			expect(screen.getByText("Failed to send message")).toBeInTheDocument();
		});
	});

	describe("receiving messages", () => {
		it("accumulates streaming text into assistant message", async () => {
			const user = userEvent.setup();
			render(<ChatPanel {...defaultProps} />);

			const textarea = screen.getByPlaceholderText("Type a message...");
			await user.type(textarea, "Hi");
			await user.click(screen.getByRole("button", { name: "Send" }));

			act(() => {
				mockState.onMessage?.({ type: "text", content: "Hello " });
				mockState.onMessage?.({ type: "text", content: "there!" });
			});

			expect(screen.getByText("Hello there!")).toBeInTheDocument();
		});

		it("displays tool calls with results", async () => {
			const user = userEvent.setup();
			render(<ChatPanel {...defaultProps} />);

			const textarea = screen.getByPlaceholderText("Type a message...");
			await user.type(textarea, "List files");
			await user.click(screen.getByRole("button", { name: "Send" }));

			act(() => {
				mockState.onMessage?.({
					type: "tool_call",
					tool_name: "Bash",
					tool_input: { command: "ls" },
					tool_use_id: "tool-1",
				});
				mockState.onMessage?.({
					type: "tool_result",
					tool_use_id: "tool-1",
					tool_result: "file1.txt",
				});
			});

			expect(screen.getByText("Bash")).toBeInTheDocument();
			// Result visible after expanding
			await user.click(screen.getByText("Bash"));
			expect(screen.getByText("file1.txt")).toBeInTheDocument();
		});

		it("shows error message from server", async () => {
			const user = userEvent.setup();
			render(<ChatPanel {...defaultProps} />);

			const textarea = screen.getByPlaceholderText("Type a message...");
			await user.type(textarea, "Hi");
			await user.click(screen.getByRole("button", { name: "Send" }));

			act(() => {
				mockState.onMessage?.({ type: "error", error: "Something went wrong" });
			});

			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		});
	});

	describe("permission requests", () => {
		it("shows dialog and sends allow response", async () => {
			const user = userEvent.setup();
			render(<ChatPanel {...defaultProps} />);

			act(() => {
				mockState.onMessage?.({
					type: "permission_request",
					request_id: "req-1",
					tool_name: "Bash",
					tool_input: { command: "rm -rf /" },
					tool_use_id: "tool-1",
				});
			});

			expect(screen.getByRole("dialog")).toBeInTheDocument();
			await user.click(screen.getByRole("button", { name: "Allow" }));

			expect(mockState.send).toHaveBeenCalledWith({
				type: "permission_response",
				session_id: "test-session",
				request_id: "req-1",
				allow: true,
			});
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});
	});

	describe("interrupt", () => {
		it("sends interrupt when Stop clicked", async () => {
			const user = userEvent.setup();
			render(<ChatPanel {...defaultProps} />);

			const textarea = screen.getByPlaceholderText("Type a message...");
			await user.type(textarea, "Hi");
			await user.click(screen.getByRole("button", { name: "Send" }));
			mockState.send.mockClear();

			await user.click(screen.getByRole("button", { name: "Stop" }));

			expect(mockState.send).toHaveBeenCalledWith({
				type: "interrupt",
				session_id: "test-session",
			});
		});
	});

});
