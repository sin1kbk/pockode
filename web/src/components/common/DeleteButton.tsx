import { Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
	itemName: string;
	itemType: string;
	onDelete: () => void;
	confirmMessage?: string;
	ariaLabel?: string;
	className?: string;
}

function DeleteButton({
	itemName,
	itemType,
	onDelete,
	confirmMessage,
	ariaLabel,
	className = "rounded p-1 text-th-text-muted transition-opacity hover:bg-th-error/10 hover:text-th-error sm:opacity-0 sm:group-hover:opacity-100",
}: Props) {
	const [showConfirm, setShowConfirm] = useState(false);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setShowConfirm(true);
	};

	const handleConfirm = () => {
		setShowConfirm(false);
		onDelete();
	};

	return (
		<>
			<button
				type="button"
				onClick={handleClick}
				className={className}
				aria-label={ariaLabel ?? `Delete ${itemName}`}
			>
				<Trash2 className="h-4 w-4" aria-hidden="true" />
			</button>

			{showConfirm && (
				<ConfirmDialog
					title={`Delete ${itemType}?`}
					message={
						confirmMessage ??
						`This will delete "${itemName}". This action cannot be undone.`
					}
					confirmLabel="Delete"
					variant="danger"
					onConfirm={handleConfirm}
					onCancel={() => setShowConfirm(false)}
				/>
			)}
		</>
	);
}

export default DeleteButton;
