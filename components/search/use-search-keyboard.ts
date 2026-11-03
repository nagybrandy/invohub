// components/search/use-search-keyboard.ts
// Native: there is no hardware keyboard contract for the results, so this is a
// no-op. The web twin (use-search-keyboard.web.ts) wires arrows, Enter and Esc.
export type SearchKeyboardOptions = {
  /** Number of selectable rows. */
  count: number;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Enter on the active row. */
  onActivate: (index: number) => void;
  /** Esc, or a click outside the field and the results. */
  onClose: () => void;
  /** DOM id of the active row (aria-activedescendant on the field). */
  activeRowId?: string;
  listId: string;
};

export function useSearchKeyboard(_options: SearchKeyboardOptions): void {
  // intentionally empty
}
