import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	THEME_INFO,
	THEME_NAMES,
	type ThemeMode,
	type ThemeName,
	useTheme,
} from "../../hooks/useTheme";

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: ReactNode }[] = [
	{
		value: "light",
		label: "Light",
		icon: (
			<svg
				className="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
				/>
			</svg>
		),
	},
	{
		value: "dark",
		label: "Dark",
		icon: (
			<svg
				className="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
				/>
			</svg>
		),
	},
	{
		value: "system",
		label: "Auto",
		icon: (
			<svg
				className="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		),
	},
];

function ThemePreview({
	themeName,
	isSelected,
	isDarkMode,
}: {
	themeName: ThemeName;
	isSelected: boolean;
	isDarkMode: boolean;
}) {
	const info = THEME_INFO[themeName];
	const accentColor = isDarkMode ? info.accentDark : info.accentLight;
	const previewBg = isDarkMode ? info.previewBgDark : info.previewBgLight;

	return (
		<div
			className="relative h-10 w-full overflow-hidden rounded-md"
			style={{ backgroundColor: previewBg }}
		>
			{/* Accent line */}
			<div
				className="absolute bottom-0 left-0 h-1 w-full"
				style={{ backgroundColor: accentColor }}
			/>
			{/* Content preview dots */}
			<div className="flex flex-col gap-1 p-2">
				<div
					className="h-1 w-8 rounded-full opacity-60"
					style={{ backgroundColor: isDarkMode ? "#fff" : "#000" }}
				/>
				<div
					className="h-1 w-5 rounded-full opacity-40"
					style={{ backgroundColor: isDarkMode ? "#fff" : "#000" }}
				/>
			</div>
			{/* Selection indicator */}
			{isSelected && (
				<div
					className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
					style={{ backgroundColor: accentColor }}
				>
					<svg
						className="h-2.5 w-2.5 text-white"
						fill="currentColor"
						viewBox="0 0 20 20"
						aria-hidden="true"
					>
						<path
							fillRule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clipRule="evenodd"
						/>
					</svg>
				</div>
			)}
		</div>
	);
}

function ThemeToggle() {
	const { mode, setMode, theme, setTheme, resolvedMode } = useTheme();
	const [isOpen, setIsOpen] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const isDarkMode = resolvedMode === "dark";
	const currentAccent = isDarkMode
		? THEME_INFO[theme].accentDark
		: THEME_INFO[theme].accentLight;

	// Close panel on outside click
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				panelRef.current &&
				!panelRef.current.contains(e.target as Node) &&
				buttonRef.current &&
				!buttonRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	// Close on Escape
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsOpen(false);
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen]);

	// Prevent body scroll when panel is open on mobile
	useEffect(() => {
		if (!isOpen) return;

		// 639px = Tailwind sm breakpoint (640px) - 1, matching sm:hidden
		const isMobile = window.matchMedia("(max-width: 639px)").matches;
		if (!isMobile) return;

		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen]);

	const modeIcon = isDarkMode ? (
		<svg
			className="h-5 w-5"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
			/>
		</svg>
	) : (
		<svg
			className="h-5 w-5"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
			/>
		</svg>
	);

	return (
		<div className="relative">
			<button
				ref={buttonRef}
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg text-th-text-muted transition-transform hover:bg-th-bg-tertiary hover:text-th-text-primary active:scale-95"
				aria-label="Theme settings"
				aria-expanded={isOpen}
			>
				{modeIcon}
				<span
					className="h-3 w-3 rounded-full"
					style={{
						backgroundColor: currentAccent,
						boxShadow: `0 0 6px ${currentAccent}40`,
					}}
					aria-hidden="true"
				/>
			</button>

			{isOpen && (
				<>
					{/* Backdrop for mobile */}
					<div
						className="fixed inset-0 z-40 bg-black/50 sm:hidden"
						onClick={() => setIsOpen(false)}
						aria-hidden="true"
					/>
					<div
						ref={panelRef}
						className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-th-border bg-th-bg-primary p-4 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:rounded-xl sm:border sm:pb-4"
						role="dialog"
						aria-label="Theme settings"
					>
						{/* Drag handle for mobile */}
						<div className="mb-4 flex justify-center sm:hidden">
							<div className="h-1 w-10 rounded-full bg-th-text-muted/30" />
						</div>
						{/* Mode Selection */}
						<div className="mb-4">
							<div className="mb-2 text-xs font-medium uppercase tracking-wider text-th-text-muted">
								Appearance
							</div>
							<div className="flex gap-1 rounded-lg bg-th-bg-secondary p-1">
								{MODE_OPTIONS.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => setMode(option.value)}
										className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-all active:scale-95 ${
											mode === option.value
												? "bg-th-bg-primary text-th-text-primary shadow-sm"
												: "text-th-text-muted hover:text-th-text-secondary"
										}`}
									>
										{option.icon}
										<span>{option.label}</span>
									</button>
								))}
							</div>
						</div>

						{/* Theme Selection */}
						<div>
							<div className="mb-2 text-xs font-medium uppercase tracking-wider text-th-text-muted">
								Theme
							</div>
							<div className="grid grid-cols-1 gap-2">
								{THEME_NAMES.map((name) => {
									const info = THEME_INFO[name];
									const isSelected = theme === name;
									return (
										<button
											key={name}
											type="button"
											onClick={() => setTheme(name)}
											className={`group overflow-hidden rounded-lg border text-left transition-all active:scale-[0.98] ${
												isSelected
													? "border-th-accent ring-1 ring-th-accent"
													: "border-th-border hover:border-th-text-muted"
											}`}
										>
											<ThemePreview
												themeName={name}
												isSelected={isSelected}
												isDarkMode={isDarkMode}
											/>
											<div className="flex min-h-12 items-center justify-between bg-th-bg-secondary px-3 py-2">
												<div>
													<div
														className={`text-sm font-medium ${isSelected ? "text-th-text-primary" : "text-th-text-secondary"}`}
													>
														{info.label}
													</div>
													<div className="text-xs text-th-text-muted">
														{info.description}
													</div>
												</div>
												<div
													className="h-4 w-4 rounded-full"
													style={{
														backgroundColor: isDarkMode
															? info.accentDark
															: info.accentLight,
													}}
												/>
											</div>
										</button>
									);
								})}
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

export default ThemeToggle;
