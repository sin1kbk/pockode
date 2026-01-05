import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock wsStore - must be defined before import
vi.mock("./wsStore", () => ({
	wsActions: {
		listSessions: vi.fn(),
		createSession: vi.fn(),
		deleteSession: vi.fn(),
		updateSessionTitle: vi.fn(),
		getHistory: vi.fn(),
	},
}));

import {
	createSession,
	deleteSession,
	getHistory,
	listSessions,
	updateSessionTitle,
} from "./sessionApi";
import { wsActions } from "./wsStore";

describe("sessionApi", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("listSessions", () => {
		it("calls wsActions.listSessions", async () => {
			const sessions = [
				{ id: "1", title: "Test", created_at: "", updated_at: "" },
			];
			vi.mocked(wsActions.listSessions).mockResolvedValue(sessions);

			const result = await listSessions();

			expect(wsActions.listSessions).toHaveBeenCalled();
			expect(result).toEqual(sessions);
		});

		it("throws when not connected", async () => {
			vi.mocked(wsActions.listSessions).mockRejectedValue(
				new Error("Not connected"),
			);

			await expect(listSessions()).rejects.toThrow("Not connected");
		});
	});

	describe("createSession", () => {
		it("calls wsActions.createSession", async () => {
			const newSession = {
				id: "new-id",
				title: "New Chat",
				created_at: "",
				updated_at: "",
			};
			vi.mocked(wsActions.createSession).mockResolvedValue(newSession);

			const result = await createSession();

			expect(wsActions.createSession).toHaveBeenCalled();
			expect(result).toEqual(newSession);
		});
	});

	describe("deleteSession", () => {
		it("calls wsActions.deleteSession with sessionId", async () => {
			vi.mocked(wsActions.deleteSession).mockResolvedValue(undefined);

			await deleteSession("session-123");

			expect(wsActions.deleteSession).toHaveBeenCalledWith("session-123");
		});
	});

	describe("updateSessionTitle", () => {
		it("calls wsActions.updateSessionTitle with params", async () => {
			vi.mocked(wsActions.updateSessionTitle).mockResolvedValue(undefined);

			await updateSessionTitle("session-123", "New Title");

			expect(wsActions.updateSessionTitle).toHaveBeenCalledWith(
				"session-123",
				"New Title",
			);
		});
	});

	describe("getHistory", () => {
		it("calls wsActions.getHistory with sessionId", async () => {
			const mockHistory = [{ type: "message", content: "hello" }];
			vi.mocked(wsActions.getHistory).mockResolvedValue(mockHistory);

			const result = await getHistory("session-123");

			expect(wsActions.getHistory).toHaveBeenCalledWith("session-123");
			expect(result).toEqual(mockHistory);
		});
	});
});
