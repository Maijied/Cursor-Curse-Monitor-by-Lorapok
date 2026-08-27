import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DeployFloatingStatusButton from "../components/ui/DeployFloatingStatusButton";

describe("DeployFloatingStatusButton", () => {
  it("renders the animated larvae floating button during deploy", () => {
    render(
      <DeployFloatingStatusButton
        status="running"
        modeLabel="Deploy"
        targetTag="v1.0.31"
        onClick={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: /open deployment status.*deploying/i });
    expect(button).toBeInTheDocument();
    expect(button.textContent).toMatch(/v1\.0\.31/);
    expect(document.querySelector(".deploy-floating-fab-ring")).toBeTruthy();
  });
});
