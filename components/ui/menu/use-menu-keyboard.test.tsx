/** @jest-environment jsdom */
// components/ui/menu/use-menu-keyboard.test.tsx
import { menuItems, nextMenuIndex, useMenuKeyboard } from "@/components/ui/menu/use-menu-keyboard";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { Platform } from "react-native";

const originalOS = Platform.OS;
beforeAll(() => {
  Platform.OS = "web";
});
afterAll(() => {
  Platform.OS = originalOS;
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("nextMenuIndex", () => {
  it("wraps with the arrow keys", () => {
    expect(nextMenuIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextMenuIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextMenuIndex("ArrowUp", 0, 3)).toBe(2);
    expect(nextMenuIndex("ArrowUp", 2, 3)).toBe(1);
  });

  it("starts from the ends when nothing is focused", () => {
    expect(nextMenuIndex("ArrowDown", -1, 3)).toBe(0);
    expect(nextMenuIndex("ArrowUp", -1, 3)).toBe(2);
  });

  it("supports Home and End and ignores everything else", () => {
    expect(nextMenuIndex("Home", 2, 3)).toBe(0);
    expect(nextMenuIndex("End", 0, 3)).toBe(2);
    expect(nextMenuIndex("Tab", 0, 3)).toBeNull();
    expect(nextMenuIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

function Menu() {
  const { ref, onKeyDown } = useMenuKeyboard();
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} role="menu" onKeyDown={onKeyDown as never}>
      <button role="menuitem" id="a">A</button>
      <button role="menuitem" id="b" disabled>B</button>
      <button role="menuitem" id="c">C</button>
    </div>
  );
}

describe("useMenuKeyboard (web)", () => {
  let host: HTMLDivElement;
  beforeEach(async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host).render(<Menu />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  });
  afterEach(() => host.remove());

  it("lists enabled menu items only", () => {
    expect(menuItems(host.querySelector("[role=menu]") as never).length).toBe(2);
  });

  it("focuses the first item on open", () => {
    expect(document.activeElement?.id).toBe("a");
  });

  it("ArrowDown skips the disabled item; ArrowUp and End/Home navigate", async () => {
    const menu = host.querySelector("[role=menu]") as HTMLElement;
    const press = async (key: string) => {
      await act(async () => {
        menu.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
    };
    await press("ArrowDown");
    expect(document.activeElement?.id).toBe("c");
    await press("ArrowDown");
    expect(document.activeElement?.id).toBe("a");
    await press("ArrowUp");
    expect(document.activeElement?.id).toBe("c");
    await press("Home");
    expect(document.activeElement?.id).toBe("a");
    await press("End");
    expect(document.activeElement?.id).toBe("c");
  });
});
