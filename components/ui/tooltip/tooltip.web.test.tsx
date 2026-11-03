/** @jest-environment jsdom */
// components/ui/tooltip/tooltip.web.test.tsx
// Web tooltip: hover and focus show it, leave / blur / Esc hide it, and it is
// wired with role="tooltip" + aria-describedby.
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Tooltip } from "@/components/ui/tooltip/index.web";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <Tooltip content="A NAV elutasította: hibás adószám.">
        <button id="nav">NAV</button>
      </Tooltip>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
});

const trigger = () => document.querySelector('[data-testid="tooltip-trigger"]') as HTMLElement;
const bubble = () => document.querySelector('[role="tooltip"]') as HTMLElement | null;

describe("Tooltip (web)", () => {
  it("is hidden until hovered", () => {
    expect(bubble()).toBeNull();
    expect(trigger().getAttribute("aria-describedby")).toBeNull();
  });

  it("shows on hover with the reason, linked by aria-describedby, and hides on leave", async () => {
    await act(async () => {
      trigger().dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(bubble()?.textContent).toBe("A NAV elutasította: hibás adószám.");
    expect(trigger().getAttribute("aria-describedby")).toBe(bubble()!.id);
    await act(async () => {
      trigger().dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(bubble()).toBeNull();
  });

  it("shows on keyboard focus and hides on blur", async () => {
    await act(async () => {
      document.getElementById("nav")!.focus();
    });
    expect(bubble()).not.toBeNull();
    await act(async () => {
      document.getElementById("nav")!.blur();
    });
    expect(bubble()).toBeNull();
  });

  it("hides on Escape", async () => {
    await act(async () => {
      document.getElementById("nav")!.focus();
    });
    expect(bubble()).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(bubble()).toBeNull();
  });

  it("uses the navy token background with white text", async () => {
    await act(async () => {
      document.getElementById("nav")!.focus();
    });
    expect(bubble()!.className).toContain("bg-navy");
    expect(bubble()!.className).toContain("text-white");
  });
});
