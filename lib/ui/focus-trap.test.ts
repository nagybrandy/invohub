/** @jest-environment jsdom */
// lib/ui/focus-trap.test.ts
import { focusInitial, getFocusable, rememberFocus, trapTab } from "@/lib/ui/focus-trap";

function setup() {
  document.body.innerHTML = `
    <button id="opener">open</button>
    <div id="dialog" tabindex="-1">
      <button id="close" data-close-button="true">x</button>
      <input id="name" />
      <button id="ok">ok</button>
      <button id="off" disabled>off</button>
    </div>`;
  return {
    opener: document.getElementById("opener")!,
    dialog: document.getElementById("dialog")!,
    close: document.getElementById("close")!,
    name: document.getElementById("name")!,
    ok: document.getElementById("ok")!,
  };
}

function tab(shiftKey = false) {
  return { key: "Tab", shiftKey, preventDefault: jest.fn() };
}

describe("getFocusable", () => {
  it("lists enabled controls in DOM order and skips disabled ones", () => {
    const { dialog } = setup();
    expect(getFocusable(dialog).map((el) => el.id)).toEqual(["close", "name", "ok"]);
  });

  it("skips elements marked aria-hidden", () => {
    const { dialog, name } = setup();
    name.setAttribute("aria-hidden", "true");
    expect(getFocusable(dialog).map((el) => el.id)).toEqual(["close", "ok"]);
  });
});

describe("trapTab", () => {
  it("wraps from the last control to the first on Tab", () => {
    const { dialog, ok, close } = setup();
    ok.focus();
    const event = tab();
    expect(trapTab(event, dialog)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(close);
  });

  it("wraps from the first control to the last on Shift+Tab", () => {
    const { dialog, ok, close } = setup();
    close.focus();
    expect(trapTab(tab(true), dialog)).toBe(true);
    expect(document.activeElement).toBe(ok);
  });

  it("pulls focus back in when it is outside the container", () => {
    const { dialog, opener, close } = setup();
    opener.focus();
    expect(trapTab(tab(), dialog)).toBe(true);
    expect(document.activeElement).toBe(close);
  });

  it("lets Tab through in the middle and ignores other keys", () => {
    const { dialog, name } = setup();
    name.focus();
    const event = tab();
    expect(trapTab(event, dialog)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(trapTab({ key: "a", shiftKey: false, preventDefault: jest.fn() }, dialog)).toBe(false);
  });

  it("keeps focus on the container when it holds nothing focusable", () => {
    document.body.innerHTML = '<div id="empty" tabindex="-1"></div>';
    const empty = document.getElementById("empty")!;
    expect(trapTab(tab(), empty)).toBe(true);
    expect(document.activeElement).toBe(empty);
  });
});

describe("focusInitial / rememberFocus", () => {
  it("focuses the first non-close control by default", () => {
    const { dialog, name } = setup();
    focusInitial(dialog);
    expect(document.activeElement).toBe(name);
  });

  it("prefers data-autofocus", () => {
    const { dialog, ok } = setup();
    ok.setAttribute("data-autofocus", "");
    focusInitial(dialog);
    expect(document.activeElement).toBe(ok);
  });

  it("restores focus to the opener", () => {
    const { dialog, opener } = setup();
    opener.focus();
    const restore = rememberFocus();
    focusInitial(dialog);
    expect(document.activeElement).not.toBe(opener);
    restore();
    expect(document.activeElement).toBe(opener);
  });

  it("does nothing if the opener left the DOM", () => {
    const { opener } = setup();
    opener.focus();
    const restore = rememberFocus();
    opener.remove();
    expect(() => restore()).not.toThrow();
  });
});
