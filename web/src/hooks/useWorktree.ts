import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import {
	getDisplayName,
	useWorktreeStore,
	worktreeActions,
} from "../lib/worktreeStore";
import {
	reconnectWebSocket,
	setWorktreeDeletedListener,
	useWSStore,
	wsActions,
} from "../lib/wsStore";
import type { WorktreeInfo } from "../types/message";

async function listWorktrees(): Promise<WorktreeInfo[]> {
	return wsActions.listWorktrees();
}

async function createWorktree(params: {
	name: string;
	branch: string;
}): Promise<void> {
	return wsActions.createWorktree(params.name, params.branch);
}

async function deleteWorktree(params: {
	name: string;
	force?: boolean;
}): Promise<void> {
	return wsActions.deleteWorktree(params.name, params.force);
}

export interface UseWorktreeOptions {
	enabled?: boolean;
	onDeleted?: (name: string) => void;
}

export function useWorktree({
	enabled = true,
	onDeleted,
}: UseWorktreeOptions = {}) {
	const queryClient = useQueryClient();
	const wsStatus = useWSStore((state) => state.status);
	const current = useWorktreeStore((state) => state.current);
	const isGitRepo = useWorktreeStore((state) => state.isGitRepo);

	const isConnected = wsStatus === "connected";
	const hasConnectedOnceRef = useRef(false);

	// Invalidate worktrees on reconnect
	useEffect(() => {
		if (isConnected) {
			if (hasConnectedOnceRef.current) {
				queryClient.invalidateQueries({ queryKey: ["worktrees"] });
			}
			hasConnectedOnceRef.current = true;
		}
	}, [isConnected, queryClient]);

	const {
		data: worktrees = [],
		isLoading,
		isSuccess,
	} = useQuery({
		queryKey: ["worktrees"],
		queryFn: listWorktrees,
		enabled: enabled && isConnected && isGitRepo,
		staleTime: Number.POSITIVE_INFINITY,
	});

	// Handle worktree deleted notification
	useEffect(() => {
		setWorktreeDeletedListener((name, wasCurrentWorktree) => {
			queryClient.invalidateQueries({ queryKey: ["worktrees"] });
			if (wasCurrentWorktree) {
				worktreeActions.setCurrent("");
				reconnectWebSocket();
			}
			onDeleted?.(name);
		});

		return () => setWorktreeDeletedListener(null);
	}, [onDeleted, queryClient]);

	const refresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["worktrees"] });
	}, [queryClient]);

	const createMutation = useMutation({
		mutationFn: createWorktree,
	});

	const deleteMutation = useMutation({
		mutationFn: deleteWorktree,
		onSuccess: (_, { name }) => {
			queryClient.setQueryData<WorktreeInfo[]>(["worktrees"], (old = []) =>
				old.filter((w) => w.name !== name),
			);
			// If we deleted the current worktree, switch to main
			if (worktreeActions.getCurrent() === name) {
				worktreeActions.setCurrent("");
				reconnectWebSocket();
			}
		},
	});

	const selectWorktree = useCallback(
		(name: string) => {
			if (name === current) return;

			worktreeActions.setCurrent(name);
			reconnectWebSocket();
		},
		[current],
	);

	// Find current worktree info
	const currentWorktree = worktrees.find((w) =>
		current ? w.name === current : w.is_main,
	);

	return {
		current,
		currentWorktree,
		worktrees,
		isLoading,
		isSuccess,
		isGitRepo,
		refresh,
		select: selectWorktree,
		create: (name: string, branch: string) =>
			createMutation.mutateAsync({ name, branch }),
		delete: (name: string, force?: boolean) =>
			deleteMutation.mutateAsync({ name, force }),
		isCreating: createMutation.isPending,
		isDeleting: deleteMutation.isPending,
		getDisplayName,
	};
}
