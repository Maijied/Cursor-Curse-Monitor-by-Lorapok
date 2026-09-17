import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { AuthContext, type AuthContextValue } from "../../lib/use-auth-session";
import CommandPalette from "../ui/CommandPalette";

vi.mock("../../lib/firebase", () => ({
  auth: { currentUser: { email: "admin@lorapok.test" } },
}));

function authValue(): AuthContextValue {
  return {
    user: { email: "admin@lorapok.test" } as User,
    session: {
      email: "admin@lorapok.test",
      role: "master",
      permissions: ["*"],
      isMaster: true,
    } as AuthContextValue["session"],
    loading: false,
    isMaster: true,
    hasPermission: () => true,
    refresh: async () => undefined,
  };
}

describe("CommandPalette", () => {
  it("shows ranked results and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue()}>
          <CommandPalette open onClose={onClose} />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search pages/i);
    fireEvent.change(input, { target: { value: "Overview" } });
    expect(screen.getByRole("option", { name: /Overview/i })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
