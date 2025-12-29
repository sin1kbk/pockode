import type { SessionMeta } from "../types/message";
import { fetchWithAuth } from "./api";

export async function listSessions(): Promise<SessionMeta[]> {
	const response = await fetchWithAuth("/api/sessions");
	const data = await response.json();
	return data.sessions;
}

export async function createSession(): Promise<SessionMeta> {
	const response = await fetchWithAuth("/api/sessions", {
		method: "POST",
	});
	return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
	await fetchWithAuth(`/api/sessions/${sessionId}`, {
		method: "DELETE",
	});
}

export async function updateSessionTitle(
	sessionId: string,
	title: string,
): Promise<void> {
	await fetchWithAuth(`/api/sessions/${sessionId}`, {
		method: "PATCH",
		body: JSON.stringify({ title }),
	});
}

export async function getHistory(sessionId: string): Promise<unknown[]> {
	const response = await fetchWithAuth(`/api/sessions/${sessionId}/history`);
	const data = await response.json();
	return data.history;
}
