import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import SectionReferLink from "../components/ui/SectionReferLink";
import { resolveSectionRefer, SECTION_REFERS } from "../lib/section-refer";

describe("section-refer", () => {
  it("resolves settings tab labels", () => {
    const resolved = resolveSectionRefer(SECTION_REFERS.settingsDiscord);
    expect(resolved.path).toBe("/dashboard/settings");
    expect(resolved.label).toBe("Settings → Discord");
    expect(resolved.settingsTab).toBe("discord");
  });

  it("resolves top-level sections", () => {
    const resolved = resolveSectionRefer(SECTION_REFERS.deployments);
    expect(resolved.path).toBe("/dashboard/deployments");
    expect(resolved.label).toBe("Deployments");
  });
});

describe("SectionReferLink", () => {
  function renderLink(props: ComponentProps<typeof SectionReferLink>) {
    return render(
      <MemoryRouter>
        <SectionReferLink {...props} />
      </MemoryRouter>,
    );
  }

  it('renders "Go to" label with arrow', () => {
    renderLink(SECTION_REFERS.mailbox);
    const link = screen.getByRole("link", { name: /Go to Mailbox/i });
    expect(link).toHaveAttribute("href", "/dashboard/mailbox");
  });

  it("links to settings tab path", () => {
    renderLink(SECTION_REFERS.settingsFirebase);
    const link = screen.getByRole("link", { name: /Go to Settings → Firebase/i });
    expect(link).toHaveAttribute("href", "/dashboard/settings");
  });

  it("supports custom label override", () => {
    renderLink({ section: "api-explorer", label: "API Explorer" });
    expect(screen.getByRole("link", { name: /Go to API Explorer/i })).toBeInTheDocument();
  });
});
