// lib/ui/focus-trap.ts
// DOM helpers for modal surfaces on web (Sheet, ConfirmDialog): list the
// focusable elements, keep Tab inside the container, and remember/restore the
// element that opened the surface. Pure functions over the DOM so they can be
// unit-tested with jsdom without any React.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"]:not([aria-disabled="true"]), [role="menuitem"]:not([aria-disabled="true"]), [role="radio"]:not([aria-disabled="true"])';

function isVisible(el: HTMLElement): boolean {
  // jsdom has no layout, so only the explicit hidden markers can be checked there.
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex !== -1 && isVisible(el),
  );
}

/**
 * Keydown handler body for the container: Tab / Shift+Tab wrap around instead
 * of leaving it. Returns true when it handled (and prevented) the event.
 */
export function trapTab(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
  container: HTMLElement,
  doc: Document = container.ownerDocument,
): boolean {
  if (event.key !== "Tab") return false;
  const items = getFocusable(container);
  if (items.length === 0) {
    event.preventDefault();
    container.focus();
    return true;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = doc.activeElement as HTMLElement | null;
  const inside = active ? container.contains(active) : false;
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

/** Focus the first element marked `data-autofocus`, else the first focusable, else the container. */
export function focusInitial(container: HTMLElement): void {
  const preferred = container.querySelector<HTMLElement>("[data-autofocus]");
  const target = preferred ?? getFocusable(container).find((el) => el.dataset.closeButton !== "true") ?? getFocusable(container)[0];
  (target ?? container).focus();
}

/** Remember the focused element now; the returned function puts focus back on it. */
export function rememberFocus(doc: Document = document): () => void {
  const previous = doc.activeElement as HTMLElement | null;
  return () => {
    if (previous && previous !== doc.body && typeof previous.focus === "function" && previous.isConnected) {
      previous.focus();
    }
  };
}
