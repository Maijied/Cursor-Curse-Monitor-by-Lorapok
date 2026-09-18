import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from "../ui/EmptyState";
import PageHeader from "../layout/PageHeader";

describe("EmptyState", () => {
  it("renders title and optional action", () => {
    render(
      <EmptyState title="Nothing yet" description="Try again later." action={<button type="button">Go</button>} />
    );
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByText("Try again later.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go" })).toBeTruthy();
  });
});

describe("PageHeader hint", () => {
  it("toggles contextual help", () => {
    render(<PageHeader title="Dense page" hint={<p>Operator tip</p>} />);
    expect(screen.queryByText("Operator tip")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Help for Dense page/i }));
    expect(screen.getByText("Operator tip")).toBeTruthy();
  });
});
