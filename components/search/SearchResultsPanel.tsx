// components/search/SearchResultsPanel.tsx
// The behaviour of the global search results (SPEC §7.2), without the
// container (the native file positions it absolutely under the field, the web
// twin portals it so no stacking context can clip it):
//   - nothing under two characters; the query is debounced 250ms;
//   - data only from the existing hooks: useInvoices({ search }) and the
//     partner / product lists filtered locally (their hooks have no search
//     option). Nyugták are left out: useReceipts has no search either.
//   - the hooks mount only while a search is active, so nothing is fetched
//     until someone types.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { SearchResultsList, searchRowId } from "@/components/search/SearchResultsList";
import { useDebouncedValue } from "@/components/search/use-debounced-value";
import { useSearchKeyboard } from "@/components/search/use-search-keyboard";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { useProducts } from "@/hooks/useProducts";
import {
  MAX_RESULTS_PER_GROUP,
  SEARCH_DEBOUNCE_MS,
  buildSearchGroups,
  flattenGroups,
  isSearchable,
  normalizeQuery,
  type SearchResult,
} from "@/lib/search/global-search";

const LIST_ID = "global-search-list";

export type SearchResultsPanelProps = {
  /** What the person typed (not trimmed). */
  query: string;
  /** Close the results and clear the field (Esc, outside press, a chosen row). */
  onClose: () => void;
  /** Wraps the rendered panel body in the platform's container. */
  renderContainer: (body: React.ReactNode) => React.ReactNode;
};

/** Renders nothing until the debounced query has two characters. */
export function SearchResultsPanel({ query, onClose, renderContainer }: SearchResultsPanelProps) {
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // Typing below the minimum hides the panel at once, without waiting for the debounce.
  if (!isSearchable(query) || !isSearchable(debounced)) return null;
  return <ActiveSearch query={normalizeQuery(debounced)} onClose={onClose} renderContainer={renderContainer} />;
}

function ActiveSearch({
  query,
  onClose,
  renderContainer,
}: {
  query: string;
  onClose: () => void;
  renderContainer: SearchResultsPanelProps["renderContainer"];
}) {
  const { t, i18n } = useTranslation();
  const invoices = useInvoices({ search: query, pageSize: MAX_RESULTS_PER_GROUP });
  const clients = useClients();
  const products = useProducts();
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const groups = React.useMemo(
    () =>
      buildSearchGroups({
        query,
        invoices: invoices.invoices,
        clients: clients.clients,
        products: products.products,
        locale: i18n.language,
      }),
    [query, invoices.invoices, clients.clients, products.products, i18n.language],
  );
  const flat = React.useMemo(() => flattenGroups(groups), [groups]);
  const loading = invoices.loading || clients.loading || products.loading;

  // A new query starts without a selected row.
  React.useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const select = React.useCallback(
    (result: SearchResult) => {
      onClose();
      router.push(result.href);
    },
    [onClose],
  );

  const active = activeIndex >= 0 && activeIndex < flat.length ? flat[activeIndex] : undefined;

  useSearchKeyboard({
    count: flat.length,
    activeIndex,
    setActiveIndex,
    onActivate: (index) => {
      const row = flat[index];
      if (row) select(row);
    },
    onClose,
    listId: LIST_ID,
    activeRowId: active ? searchRowId(LIST_ID, active.key) : undefined,
  });

  const body =
    flat.length > 0 ? (
      <>
        <SearchResultsList
          groups={groups}
          query={query}
          activeKey={active?.key}
          listId={LIST_ID}
          onSelect={select}
          onHover={(result) => setActiveIndex(flat.findIndex((row) => row.key === result.key))}
        />
        <Text accessibilityLiveRegion="polite" className="sr-only">
          {t("globalSearch.resultCount", { count: flat.length })}
        </Text>
      </>
    ) : loading ? (
      <Box className="px-2.5 py-3">
        <Text testID="global-search-loading" className="text-[13px] text-muted-ink">
          {t("globalSearch.loading")}
        </Text>
      </Box>
    ) : (
      <Box className="px-2.5 py-3">
        <Text testID="global-search-empty" accessibilityLiveRegion="polite" className="text-sm text-muted-ink">
          {t("globalSearch.noResults", { query })}
        </Text>
      </Box>
    );

  return <>{renderContainer(body)}</>;
}
