import { useQuery } from "@tanstack/react-query";
import { getGitStatus } from "../lib/gitApi";

export function useGitStatus() {
	return useQuery({
		queryKey: ["git-status"],
		queryFn: getGitStatus,
		staleTime: 30_000, // 30 seconds
	});
}
