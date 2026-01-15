import { describe, expect, it } from "vitest";
import { getDisplayName } from "./worktreeStore";

describe("getDisplayName", () => {
	it("returns branch for main worktree", () => {
		const worktree = {
			name: "",
			path: "/path/to/main",
			branch: "main",
			is_main: true,
		};
		expect(getDisplayName(worktree)).toBe("main");
	});

	it("returns name for non-main worktree", () => {
		const worktree = {
			name: "feature-x",
			path: "/path/to/feature-x",
			branch: "feature/x",
			is_main: false,
		};
		expect(getDisplayName(worktree)).toBe("feature-x");
	});
});
