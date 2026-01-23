interface Props {
	show: boolean;
	className?: string;
}

/**
 * Notification badge dot indicator.
 * Use within a `relative` positioned parent.
 */
export default function BadgeDot({ show, className = "" }: Props) {
	if (!show) return null;
	return (
		<span
			className={`absolute h-2 w-2 rounded-full bg-th-accent ${className}`}
		/>
	);
}
