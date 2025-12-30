import type { GitDiffResponse, GitStatus } from "../types/git";
import { fetchWithAuth } from "./api";

// Encode path segments individually, preserving slashes
function encodePathSegments(path: string): string {
	return path.split("/").map(encodeURIComponent).join("/");
}

export async function getGitStatus(): Promise<GitStatus> {
	const response = await fetchWithAuth("/api/git/status");
	try {
		return await response.json();
	} catch (e) {
		throw new Error(
			`Failed to parse git status: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

export async function getGitDiff(
	path: string,
	staged: boolean,
): Promise<string> {
	const type = staged ? "staged" : "unstaged";
	const encodedPath = encodePathSegments(path);
	const response = await fetchWithAuth(`/api/git/${type}/${encodedPath}`);
	try {
		const data: GitDiffResponse = await response.json();
		return data.diff;
	} catch (e) {
		throw new Error(
			`Failed to parse git diff: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}
