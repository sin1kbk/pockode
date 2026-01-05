import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWSStore } from "../lib/wsStore";

export function useGitStatus() {
	const queryClient = useQueryClient();
	const getStatus = useWSStore((state) => state.actions.getStatus);

	const query = useQuery({
		queryKey: ["git-status"],
		queryFn: getStatus,
		staleTime: Number.POSITIVE_INFINITY,
	});

	const refresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["git-status"] });
	}, [queryClient]);

	return { ...query, refresh };
}
