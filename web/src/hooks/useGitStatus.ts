import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWSStore } from "../lib/wsStore";

export const gitStatusQueryKey = ["git-status"] as const;

export function useGitStatus() {
	const queryClient = useQueryClient();
	const getStatus = useWSStore((state) => state.actions.getStatus);

	const query = useQuery({
		queryKey: gitStatusQueryKey,
		queryFn: getStatus,
		staleTime: Number.POSITIVE_INFINITY,
	});

	const refresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: gitStatusQueryKey });
	}, [queryClient]);

	return { ...query, refresh };
}
