import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSidebarRefresh } from "../Layout";
import FileTree from "./FileTree";

interface Props {
	onSelectFile: (path: string) => void;
	activeFilePath: string | null;
}

function FilesTab({ onSelectFile, activeFilePath }: Props) {
	const queryClient = useQueryClient();

	const handleRefresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["contents"] });
	}, [queryClient]);

	const { isActive } = useSidebarRefresh("files", handleRefresh);

	if (!isActive) return null;

	return (
		<FileTree onSelectFile={onSelectFile} activeFilePath={activeFilePath} />
	);
}

export default FilesTab;
