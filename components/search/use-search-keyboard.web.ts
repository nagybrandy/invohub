// components/search/use-search-keyboard.web.ts
// Web keyboard model for the global search results (SPEC §7.2). Real focus
// stays in the field; the active row is announced through
// aria-activedescendant (the field itself lives in the shell, so the
// attributes are set on the DOM node). ArrowDown / ArrowUp move (wrapping),
// Enter opens the active row, Esc closes and puts focus back on the field,
// a pointer press outside the field and the results closes.
import * as React from "react";
import { moveActiveIndex } from "@/lib/search/global-search";
import type { SearchKeyboardOptions } from "@/components/search/use-search-keyboard";

export type { SearchKeyboardOptions } from "@/components/search/use-search-keyboard";

/** testID of the field in components/navigation/GlobalSearchField.tsx and its root. */
const FIELD_SELECTOR = '[data-testid="global-search"]';
const FIELD_ROOT_SELECTOR = '[data-testid="global-search-root"]';
const RESULTS_SELECTOR = '[data-testid="global-search-results"]';

export function useSearchKeyboard(options: SearchKeyboardOptions): void {
  const ref = React.useRef(options);
  ref.current = options;

  React.useEffect(() => {
    function field(): HTMLElement | null {
      return document.querySelector<HTMLElement>(FIELD_SELECTOR);
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as Element | null;
      const inField = Boolean(target?.closest?.(FIELD_SELECTOR));
      const inResults = Boolean(target?.closest?.(RESULTS_SELECTOR));
      if (!inField && !inResults) return;
      const { count, activeIndex, setActiveIndex, onActivate, onClose } = ref.current;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (count === 0) return;
        event.preventDefault();
        setActiveIndex(moveActiveIndex(activeIndex, event.key === "ArrowDown" ? 1 : -1, count));
      } else if (event.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= count) return;
        event.preventDefault();
        onActivate(activeIndex);
      } else if (event.key === "Escape") {
        onClose();
        // The shell's reset blurs the field; give focus back on the next frame.
        requestAnimationFrame(() => field()?.focus());
      }
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest?.(FIELD_ROOT_SELECTOR) || target?.closest?.(RESULTS_SELECTOR)) return;
      ref.current.onClose();
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  // aria-activedescendant / aria-controls on the field.
  React.useEffect(() => {
    const input = document.querySelector<HTMLElement>(FIELD_SELECTOR);
    if (!input) return;
    input.setAttribute("aria-controls", options.listId);
    if (options.activeRowId) input.setAttribute("aria-activedescendant", options.activeRowId);
    else input.removeAttribute("aria-activedescendant");
    return () => {
      input.removeAttribute("aria-controls");
      input.removeAttribute("aria-activedescendant");
    };
  }, [options.activeRowId, options.listId]);
}
