/** @jest-environment jsdom */
// lib/ui/confirm.web.test.tsx
// confirmAsync keeps its API on web but now shows the design's dialog.
import { act } from "react";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1200, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", destructive: "#c00", primary: "#00c" }),
}));
jest.mock("lucide-react-native", () => ({
  X: () => null,
  AlertTriangle: () => null,
}));

import { confirmAsync } from "@/lib/ui/confirm.web";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const options = {
  title: "Számla törlése",
  message: "Ez nem vonható vissza.",
  confirmLabel: "Törlés",
  cancelLabel: "Mégse",
  destructive: true,
};

async function settleTimers() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

beforeEach(() => {
  document.body.innerHTML = '<button id="trigger">trigger</button>';
});

describe("confirmAsync (web)", () => {
  it("renders a labelled dialog with the title, message and both actions", async () => {
    let promise!: Promise<boolean>;
    await act(async () => {
      promise = confirmAsync(options);
    });
    await settleTimers();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-label")).toBe("Számla törlése");
    expect(dialog.textContent).toContain("Ez nem vonható vissza.");
    expect(document.querySelector('[data-testid="confirm-dialog-confirm"]')?.textContent).toBe("Törlés");
    expect(document.querySelector('[data-testid="confirm-dialog-cancel"]')?.textContent).toBe("Mégse");
    await act(async () => {
      (document.querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLElement).click();
    });
    await promise;
  });

  it("resolves true on the action", async () => {
    let promise!: Promise<boolean>;
    await act(async () => {
      promise = confirmAsync(options);
    });
    await settleTimers();
    await act(async () => {
      (document.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLElement).click();
    });
    await expect(promise).resolves.toBe(true);
    await settleTimers();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("[data-confirm-host]")).toBeNull();
  });

  it("resolves false on Mégse, Esc and scrim click", async () => {
    for (const how of ["cancel", "escape", "scrim"] as const) {
      let promise!: Promise<boolean>;
      await act(async () => {
        promise = confirmAsync(options);
      });
      await settleTimers();
      await act(async () => {
        if (how === "cancel") (document.querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLElement).click();
        if (how === "escape") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        if (how === "scrim") (document.querySelector('[data-testid="confirm-dialog-scrim"]') as HTMLElement).click();
      });
      await expect(promise).resolves.toBe(false);
      await settleTimers();
    }
  });

  it("puts initial focus on the safe choice (cancel)", async () => {
    let promise!: Promise<boolean>;
    await act(async () => {
      promise = confirmAsync(options);
    });
    await settleTimers();
    expect((document.activeElement as HTMLElement).dataset.testid).toBe("confirm-dialog-cancel");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await promise;
  });

  it("returns focus to the trigger after closing", async () => {
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    trigger.focus();
    let promise!: Promise<boolean>;
    await act(async () => {
      promise = confirmAsync(options);
    });
    await settleTimers();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await promise;
    await settleTimers();
    expect(document.activeElement).toBe(trigger);
  });
});
