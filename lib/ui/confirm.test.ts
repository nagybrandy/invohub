// lib/ui/confirm.test.ts
import { Alert } from "react-native";
import { confirmAsync } from "@/lib/ui/confirm";

describe("confirmAsync (native)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves true when the confirm button is pressed", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const confirmButton = buttons?.find((b) => b.text === "Delete");
      confirmButton?.onPress?.();
    });

    const result = await confirmAsync({
      title: "Delete invoice",
      message: "Remove INV-1?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      destructive: true,
    });

    expect(result).toBe(true);
  });

  it("resolves false when the cancel button is pressed", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const cancelButton = buttons?.find((b) => b.text === "Cancel");
      cancelButton?.onPress?.();
    });

    const result = await confirmAsync({
      title: "Delete invoice",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });

    expect(result).toBe(false);
  });

  it("resolves false on dismiss without a button press", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, _buttons, options) => {
      options?.onDismiss?.();
    });

    const result = await confirmAsync({
      title: "Delete invoice",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });

    expect(result).toBe(false);
  });
});
