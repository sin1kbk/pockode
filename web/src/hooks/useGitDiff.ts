import { useQuery } from "@tanstack/react-query";
import { useWSStore } from "../lib/wsStore";

interface UseGitDiffOptions {
	path: string;
	staged: boolean;
	enabled?: boolean;
}

export function useGitDiff({
	path,
	staged,
	enabled = true,
}: UseGitDiffOptions) {
	const getDiff = useWSStore((state) => state.actions.getDiff);

	return useQuery({
		queryKey: ["git-diff", path, staged],
		queryFn: () => getDiff(path, staged),
		enabled: enabled && !!path,
		staleTime: 0,
	});
}
