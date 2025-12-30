import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";

interface Props {
	diff: string;
}

function DiffContent({ diff }: Props) {
	// Check for binary file (git outputs "Binary files ... differ")
	if (diff.includes("Binary files") && diff.includes(" differ")) {
		return (
			<div className="p-4 text-center text-th-text-muted">
				Binary file - cannot display diff
			</div>
		);
	}

	// react-diff-view expects unified diff format
	const files = parseDiff(diff);

	if (files.length === 0) {
		return (
			<div className="p-4 text-center text-th-text-muted">
				No diff content to display
			</div>
		);
	}

	return (
		<div className="diff-view-wrapper">
			{files.map((file) => (
				<Diff
					key={file.newPath || file.oldPath}
					viewType="unified"
					diffType={file.type}
					hunks={file.hunks}
				>
					{(hunks) =>
						hunks.map((hunk) => (
							<Hunk key={`${hunk.oldStart}-${hunk.newStart}`} hunk={hunk} />
						))
					}
				</Diff>
			))}
		</div>
	);
}

export default DiffContent;
