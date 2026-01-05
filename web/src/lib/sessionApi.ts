import type { SessionMeta } from "../types/message";
import { wsActions } from "./wsStore";

export async function listSessions(): Promise<SessionMeta[]> {
	return wsActions.listSessions();
}

export async function createSession(): Promise<SessionMeta> {
	return wsActions.createSession();
}

export async function deleteSession(sessionId: string): Promise<void> {
	return wsActions.deleteSession(sessionId);
}

export async function updateSessionTitle(
	sessionId: string,
	title: string,
): Promise<void> {
	return wsActions.updateSessionTitle(sessionId, title);
}

export async function getHistory(sessionId: string): Promise<unknown[]> {
	return wsActions.getHistory(sessionId);
}
