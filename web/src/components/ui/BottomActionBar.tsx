import type { ReactNode } from "react";

interface Props {
	children: ReactNode;
}

function BottomActionBar({ children }: Props) {
	return (
		<div className="shrink-0 border-t border-th-border bg-th-bg-secondary px-3 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
			{children}
		</div>
	);
}

export default BottomActionBar;
