import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import DiscordDeploymentPreview from "./DiscordDeploymentPreview";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
});

describe("DiscordDeploymentPreview", () => {
  it("renders a single consolidated deployment card preview", () => {
    render(<DiscordDeploymentPreview />);
    expect(screen.getByText("Discord preview")).toBeInTheDocument();
    expect(screen.getByText("Single card")).toBeInTheDocument();
    expect(screen.getByText("✅ Deployment succeeded")).toBeInTheDocument();
    expect(screen.getByText("📦 Release sync")).toBeInTheDocument();
    expect(screen.getByText("📊 Reach & engagement")).toBeInTheDocument();
    expect(screen.getByText("🔗 Links")).toBeInTheDocument();
  });
});
