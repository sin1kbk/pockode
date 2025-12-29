import { QueryClient } from "@tanstack/react-query";
import { HttpError } from "./api";
import { authActions } from "./authStore";

function isUnauthorized(error: unknown): boolean {
	return error instanceof HttpError && error.status === 401;
}

export function createQueryClient(): QueryClient {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: (failureCount, error) => {
					if (isUnauthorized(error)) {
						return false;
					}
					return failureCount < 3;
				},
			},
			mutations: {
				retry: false,
			},
		},
	});

	queryClient.getQueryCache().subscribe((event) => {
		if (event.type === "updated" && isUnauthorized(event.query.state.error)) {
			authActions.logout();
		}
	});

	queryClient.getMutationCache().subscribe((event) => {
		if (
			event.type === "updated" &&
			isUnauthorized(event.mutation?.state.error)
		) {
			authActions.logout();
		}
	});

	return queryClient;
}
