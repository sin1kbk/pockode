type Tab = "sessions" | "diff";

interface Props {
	activeTab: Tab;
	onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
	{ id: "sessions", label: "Sessions" },
	{ id: "diff", label: "Diff" },
];

function SidebarTabs({ activeTab, onTabChange }: Props) {
	return (
		<div className="flex border-b border-th-border">
			{TABS.map((tab) => (
				<button
					key={tab.id}
					type="button"
					onClick={() => onTabChange(tab.id)}
					className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
						activeTab === tab.id
							? "border-b-2 border-th-accent text-th-accent"
							: "text-th-text-muted hover:text-th-text-primary"
					}`}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}

export default SidebarTabs;
export type { Tab };
