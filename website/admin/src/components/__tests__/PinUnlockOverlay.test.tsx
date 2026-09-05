import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PinUnlockOverlay from "../ui/PinUnlockOverlay";
import { createPinRecord, saveLocalPinRecord } from "../../lib/pin-unlock";

describe("PinUnlockOverlay", () => {
  it("unlocks with correct PIN and marks session", async () => {
    const email = "admin@lorapok.tech";
    const pin = "5678";
    const record = await createPinRecord(email, pin);
    saveLocalPinRecord(record);

    const onUnlocked = vi.fn();
    render(<PinUnlockOverlay email={email} onUnlocked={onUnlocked} onUseFullSignIn={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/enter your pin/i), { target: { value: pin } });
    fireEvent.click(screen.getByRole("button", { name: /unlock mission control/i }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
  });

  it("shows error for wrong PIN", async () => {
    const email = "admin@lorapok.tech";
    const record = await createPinRecord(email, "1111");
    saveLocalPinRecord(record);

    render(<PinUnlockOverlay email={email} onUnlocked={vi.fn()} onUseFullSignIn={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/enter your pin/i), { target: { value: "2222" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock mission control/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument();
    });
  });
});
