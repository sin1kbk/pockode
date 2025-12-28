import { useEffect, useRef } from "react";
import type {
	PermissionRequest,
	PermissionRuleValue,
	PermissionUpdate,
	PermissionUpdateDestination,
} from "../../types/message";

interface Props {
	request: PermissionRequest;
	onAllow: () => void;
	onAlwaysAllow: () => void;
	onDeny: () => void;
}

// Format permission rules for display (e.g., "Bash(go build:*)")
function formatPermissionRule(rule: PermissionRuleValue): string {
	if (rule.ruleContent) {
		return `${rule.toolName}(${rule.ruleContent})`;
	}
	return rule.toolName;
}

// Get human-readable destination label
function getDestinationLabel(destination: PermissionUpdateDestination): string {
	switch (destination) {
		case "session":
			return "this session";
		case "projectSettings":
			return "this project";
		case "localSettings":
			return "local settings";
		case "userSettings":
			return "all projects";
	}
}

// Check if the update type has rules
function hasRules(
	update: PermissionUpdate,
): update is PermissionUpdate & { rules: PermissionRuleValue[] } {
	return "rules" in update;
}

function PermissionDialog({ request, onAllow, onAlwaysAllow, onDeny }: Props) {
	const allowButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		allowButtonRef.current?.focus();

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onDeny();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onDeny]);

	const formatInput = (input: unknown): string => {
		if (typeof input === "string") return input;
		try {
			return JSON.stringify(input, null, 2);
		} catch {
			return String(input);
		}
	};

	const suggestion: PermissionUpdate | undefined =
		request.permissionSuggestions?.[0];

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-th-bg-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="permission-dialog-title"
		>
			<div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg bg-th-bg-secondary shadow-xl">
				<div className="border-b border-th-border p-4">
					<h2
						id="permission-dialog-title"
						className="text-lg font-semibold text-th-text-primary"
					>
						Tool Permission Request
					</h2>
					<p className="mt-1 text-sm text-th-text-muted">
						The AI wants to use a tool. Do you allow it?
					</p>
				</div>

				<div className="max-h-[50vh] overflow-y-auto p-4">
					<div className="mb-3">
						<span className="text-sm text-th-text-muted">Tool:</span>
						<span className="ml-2 font-mono text-th-accent">
							{request.toolName}
						</span>
					</div>

					<div>
						<span className="text-sm text-th-text-muted">Input:</span>
						<pre className="mt-2 overflow-x-auto rounded bg-th-code-bg p-3 text-sm text-th-code-text">
							{formatInput(request.toolInput)}
						</pre>
					</div>
				</div>

				{suggestion && hasRules(suggestion) && (
					<div className="border-t border-th-border bg-th-bg-primary/50 px-4 py-3">
						<p className="mb-1 text-xs text-th-text-muted">
							"Always Allow" will add to{" "}
							{getDestinationLabel(suggestion.destination)}:
						</p>
						<div className="flex flex-wrap gap-1.5">
							{suggestion.rules.map((rule, idx) => (
								<code
									key={`${rule.toolName}-${idx}`}
									className="rounded bg-th-success/20 px-1.5 py-0.5 text-xs text-th-success"
								>
									{formatPermissionRule(rule)}
								</code>
							))}
						</div>
					</div>
				)}

				<div className="flex justify-end gap-3 border-t border-th-border p-4">
					<button
						type="button"
						onClick={onDeny}
						className="rounded-lg bg-th-bg-tertiary px-4 py-2 text-sm font-medium text-th-text-primary transition-colors hover:opacity-90"
					>
						Deny
					</button>
					{suggestion && (
						<button
							type="button"
							onClick={onAlwaysAllow}
							className="rounded-lg bg-th-success px-4 py-2 text-sm font-medium text-th-text-inverse transition-colors hover:opacity-90"
						>
							Always Allow
						</button>
					)}
					<button
						ref={allowButtonRef}
						type="button"
						onClick={onAllow}
						className="rounded-lg bg-th-accent px-4 py-2 text-sm font-medium text-th-accent-text transition-colors hover:bg-th-accent-hover"
					>
						Allow
					</button>
				</div>
			</div>
		</div>
	);
}

export default PermissionDialog;
