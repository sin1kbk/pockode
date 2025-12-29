import { getApiBaseUrl } from "../utils/config";
import { authActions } from "./authStore";

export class HttpError extends Error {
	readonly status: number;

	constructor(status: number) {
		super(`HTTP ${status}`);
		this.name = "HttpError";
		this.status = status;
	}
}

export async function fetchWithAuth(
	path: string,
	options: RequestInit = {},
): Promise<Response> {
	const token = authActions.getToken();
	const response = await fetch(`${getApiBaseUrl()}${path}`, {
		...options,
		headers: {
			...options.headers,
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new HttpError(response.status);
	}

	return response;
}
