// components/search/GlobalSearchResults.tsx
// STUB. The shell's GlobalSearchField renders this under the field with the
// current query; the home track replaces it with the real results popover
// (grouped Számlák / Partnerek / Termékek, keyboard navigation, SPEC §7.2).
// Keep the props: the field relies on them.
export type GlobalSearchResultsProps = {
  /** What the person typed (not trimmed). */
  query: string;
  /** Close the results and clear the field (Esc, a chosen result). */
  onClose: () => void;
  /** Where the results are shown: a popover under the desktop field, or a full-width panel on phones. */
  variant?: "popover" | "panel";
};

export function GlobalSearchResults(_props: GlobalSearchResultsProps): null {
  return null;
}
