interface Props {
	onClick: () => void;
	isActive?: boolean;
}

function CommandTrigger({ onClick, isActive }: Props) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-medium ${
				isActive
					? "bg-th-accent text-th-accent-text"
					: "bg-th-bg-tertiary text-th-text-muted hover:text-th-text-primary"
			}`}
			aria-label="Toggle commands"
			aria-pressed={isActive}
		>
			/
		</button>
	);
}

export default CommandTrigger;
