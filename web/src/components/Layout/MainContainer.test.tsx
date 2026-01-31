import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MainContainer from "./MainContainer";

describe("MainContainer", () => {
	it("renders title", () => {
		render(<MainContainer title="My Project">{null}</MainContainer>);
		expect(screen.getByRole("heading", { name: "My Project" })).toBeInTheDocument();
	});

	it("renders agent type in parentheses with muted style when provided", () => {
		render(
			<MainContainer title="Pockode" agentType="cursor-agent">
				{null}
			</MainContainer>,
		);
		const agentLabel = screen.getByText("(cursor-agent)");
		expect(agentLabel).toBeInTheDocument();
		expect(agentLabel).toHaveClass("text-th-text-muted");
	});

	it("does not render agent label when agentType is not provided", () => {
		render(<MainContainer title="Pockode">{null}</MainContainer>);
		expect(screen.getByRole("heading", { name: "Pockode" })).toBeInTheDocument();
		expect(screen.queryByText(/\(.*\)/)).not.toBeInTheDocument();
	});

	it("does not render agent label when agentType is empty", () => {
		render(
			<MainContainer title="Pockode" agentType="">
				{null}
			</MainContainer>,
		);
		expect(screen.queryByText(/\(.*\)/)).not.toBeInTheDocument();
	});
});
