/** @jest-environment jsdom */
// components/ui/sheet/sheet.web.test.tsx
// Web Sheet behaviour: aria, Esc / scrim / close button, focus trap and
// restore, and sheet-vs-dialog presentation by width.
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockDims = { width: 375 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666" }),
}));
jest.mock("lucide-react-native", () => ({
  X: () => null,
}));

import { Sheet } from "@/components/ui/sheet/index.web";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function Harness({ onClose, withInput = true }: { onClose: () => void; withInput?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button id="opener" onClick={() => setOpen(true)}>
        open
      </button>
      <Sheet
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Szűrés"
        footer={<button id="apply">Alkalmaz</button>}
      >
        {withInput ? <input id="field" /> : null}
        <button id="inner">belső</button>
      </Sheet>
    </>
  );
}

async function mount(onClose = jest.fn(), withInput = true) {
  await act(async () => {
    root.render(<Harness onClose={onClose} withInput={withInput} />);
  });
  const opener = document.getElementById("opener") as HTMLButtonElement;
  opener.focus();
  await act(async () => {
    opener.click();
  });
  // focus move is deferred a tick
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  return { opener, onClose };
}

beforeEach(() => {
  mockDims.width = 375;
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("Sheet (web)", () => {
  it("renders nothing while closed", async () => {
    await act(async () => {
      root.render(<Sheet open={false} onClose={() => {}} title="x" />);
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("is a labelled aria-modal dialog", async () => {
    await mount();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelledBy)?.textContent).toBe("Szűrés");
  });

  it("is a bottom sheet at 375 and a centred dialog (max 460) at 820", async () => {
    await mount();
    let dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("rounded-t-sheet");
    await act(async () => root.unmount());
    root = createRoot(container);
    mockDims.width = 820;
    await mount();
    dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.className).toContain("rounded-dialog");
    expect(dialog.style.maxWidth).toBe("460px");
  });

  it("moves focus into the dialog on open, past the close button", async () => {
    await mount();
    expect(document.activeElement?.id).toBe("field");
  });

  it("closes on Escape and returns focus to the opener", async () => {
    const { opener, onClose } = await mount();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on a scrim click and via the close button, restoring focus", async () => {
    const first = await mount();
    await act(async () => {
      (document.querySelector('[data-testid="sheet-scrim"]') as HTMLElement).click();
    });
    expect(first.onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(first.opener);

    await act(async () => {
      first.opener.click();
    });
    await act(async () => {
      (document.querySelector('[data-testid="sheet-close"]') as HTMLElement).click();
    });
    expect(first.onClose).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(first.opener);
  });

  it("traps Tab inside: from the last control it wraps to the first", async () => {
    await mount();
    const apply = document.getElementById("apply")!;
    apply.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    // first focusable inside the panel is the close button
    expect((document.activeElement as HTMLElement).dataset.closeButton).toBe("true");
  });

  it("Shift+Tab from the first control wraps to the last", async () => {
    await mount();
    const close = document.querySelector('[data-close-button="true"]') as HTMLElement;
    close.focus();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement?.id).toBe("apply");
  });

  it("locks body scroll while open and releases it on close", async () => {
    await mount();
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");
  });

  it("uses the translated close label", async () => {
    await mount();
    expect(document.querySelector('[data-testid="sheet-close"]')?.getAttribute("aria-label")).toBe("ui.close");
  });
});
