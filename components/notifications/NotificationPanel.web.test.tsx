/** @jest-environment jsdom */
// components/notifications/NotificationPanel.web.test.tsx
// The web container (SPEC §7.3): a popover under the bell above 700px and the
// foundation Sheet at or below it. Esc and an outside press close it, a press
// on the bell toggles it, Tab stays inside, and focus goes back to the bell.
// The content is replaced by a stub here (it is covered by NotificationPanel.test.tsx).
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockDims = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666" }),
}));
jest.mock("lucide-react-native", () => ({ X: () => null }));
// Jest resolves the native file; the web panel is meant to get the web Sheet.
jest.mock("@/components/ui/sheet", () => require("@/components/ui/sheet/index.web"));
jest.mock("@/components/ui/box", () => ({
  Box: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/notifications/NotificationPanelContent", () => ({
  NotificationPanelContent: ({
    onClose,
    renderList,
  }: {
    onClose: () => void;
    renderList?: (list: React.ReactNode) => React.ReactNode;
  }) => (
    <div>
      <button data-testid="first-control">Mind olvasott</button>
      {(renderList ?? ((list: React.ReactNode) => list))(<div data-testid="list">list</div>)}
      <button data-testid="close-from-content" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

import { NotificationPanel } from "@/components/notifications/NotificationPanel.web";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button data-testid="notification-bell" id="bell" onClick={() => setOpen(true)}>
        bell
      </button>
      <button id="elsewhere">elsewhere</button>
      <NotificationPanel
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        notifications={[]}
        unreadCount={0}
        loading={false}
        onMarkRead={jest.fn()}
        onMarkAllRead={jest.fn()}
      />
    </>
  );
}

function mount(onClose = jest.fn()) {
  act(() => {
    root.render(<Harness onClose={onClose} />);
  });
  return onClose;
}

function openFromBell() {
  const bell = document.getElementById("bell") as HTMLButtonElement;
  bell.focus();
  act(() => {
    bell.click();
  });
  act(() => {
    jest.advanceTimersByTime(10);
  });
  return bell;
}

beforeEach(() => {
  jest.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockDims.width = 1440;
  // requestAnimationFrame is used by the Sheet's enter animation.
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("NotificationPanel (web) at 1440", () => {
  it("shows nothing until opened, then a labelled dialog popover under the bell", () => {
    mount();
    expect(document.querySelector('[data-testid="notification-panel"]')).toBeNull();
    openFromBell();
    const panel = document.querySelector('[data-testid="notification-panel"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-label")).toBe("notifications.panel.title");
    expect(panel.className).toContain("top-[62px]");
    expect(panel.className).toContain("w-[420px]");
    // No scrim: it is a popover, not a modal sheet.
    expect(document.querySelector('[data-testid="notification-panel-scrim"]')).toBeNull();
  });

  it("scrolls only the list", () => {
    mount();
    openFromBell();
    const list = document.querySelector('[data-testid="list"]') as HTMLElement;
    expect(list.parentElement?.className).toContain("overflow-y-auto");
  });

  it("moves focus into the panel when opened", () => {
    mount();
    openFromBell();
    expect(document.activeElement?.getAttribute("data-testid")).toBe("first-control");
  });

  it("Esc closes it and focus returns to the bell", () => {
    const onClose = mount();
    const bell = openFromBell();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="notification-panel"]')).toBeNull();
    expect(document.activeElement).toBe(bell);
  });

  it("a press outside closes it", () => {
    const onClose = mount();
    openFromBell();
    act(() => {
      document.getElementById("elsewhere")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a press inside does not close it", () => {
    const onClose = mount();
    openFromBell();
    act(() => {
      document.querySelector('[data-testid="list"]')!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a click on the bell while open closes it instead of re-opening it", () => {
    const onClose = mount();
    const bell = openFromBell();
    act(() => {
      bell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      bell.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="notification-panel"]')).toBeNull();
  });

  it("Tab wraps inside the panel", () => {
    mount();
    openFromBell();
    const last = document.querySelector('[data-testid="close-from-content"]') as HTMLElement;
    last.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    act(() => {
      last.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.getAttribute("data-testid")).toBe("first-control");
  });
});

describe("NotificationPanel (web) at 375", () => {
  it("is the bottom sheet from under the top bar, with a scrim", () => {
    mockDims.width = 375;
    mount();
    openFromBell();
    const sheet = document.querySelector('[data-testid="notification-panel"]');
    expect(sheet).not.toBeNull();
    expect(document.querySelector('[data-testid="notification-panel-scrim"]')).not.toBeNull();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.style.top).toBe("64px");
  });

  it("Esc closes the sheet and focus returns to the bell", () => {
    mockDims.width = 375;
    const onClose = mount();
    const bell = openFromBell();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(bell);
  });
});
