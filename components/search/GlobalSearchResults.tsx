// components/search/GlobalSearchResults.tsx
// Native global search results (SPEC §7.2): rendered by the shell's
// GlobalSearchField inside the field's box, absolutely under it. The web twin
// portals the same panel to <body>. Props are the shell's contract: keep them.
import { Box } from "@/components/ui/box";
import { SearchResultsPanel } from "@/components/search/SearchResultsPanel";

export type GlobalSearchResultsProps = {
  /** What the person typed (not trimmed). */
  query: string;
  /** Close the results and clear the field (Esc, a chosen result). */
  onClose: () => void;
  /** Where the results are shown: a popover under the desktop field, or a full-width panel on phones. */
  variant?: "popover" | "panel";
};

export function GlobalSearchResults({ query, onClose, variant = "popover" }: GlobalSearchResultsProps) {
  return (
    <SearchResultsPanel
      query={query}
      onClose={onClose}
      renderContainer={(body) => (
        <Box
          testID="global-search-results"
          className={`absolute top-full z-50 mt-1.5 max-h-[70%] rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu ${
            variant === "panel" ? "left-0 right-0" : "right-0 w-[460px] max-w-[calc(100vw-16px)]"
          }`}
        >
          {body}
        </Box>
      )}
    />
  );
}
