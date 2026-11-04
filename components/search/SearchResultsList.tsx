// components/search/SearchResultsList.tsx
// The rows of the global search popover (tokens.md §6.11): group headings
// (12px 600 muted), rows with an icon, the title and sub line with the match
// highlighted, and the invoice amount on the right. Presentational: the
// parent owns the data, the active row and what a click does.
import { FileText, Package, Users } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { highlightSegments, type SearchGroup, type SearchGroupKey, type SearchResult } from "@/lib/search/global-search";
import { useIconColors } from "@/lib/theme/icon-colors";

const GROUP_ICONS: Record<SearchGroupKey, LucideIcon> = {
  invoices: FileText,
  clients: Users,
  products: Package,
};

export function searchRowId(listId: string, key: string): string {
  return `${listId}-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function Highlighted({ text, query, className }: { text: string; query: string; className: string }) {
  const segments = highlightSegments(text, query);
  return (
    <Text numberOfLines={1} className={className}>
      {segments.map((segment, index) =>
        segment.match ? (
          <Text key={index} testID="search-match" className="rounded-sm bg-warn-wash text-ink">
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </Text>
  );
}

export type SearchResultsListProps = {
  groups: SearchGroup[];
  query: string;
  activeKey?: string;
  listId: string;
  onSelect: (result: SearchResult) => void;
  onHover: (result: SearchResult) => void;
};

export function SearchResultsList({ groups, query, activeKey, listId, onSelect, onHover }: SearchResultsListProps) {
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    // RN's Role type has no "listbox"; react-native-web passes it through.
    <VStack {...({ role: "listbox" } as object)} nativeID={listId} accessibilityLabel={t("globalSearch.resultsLabel")}>
      {groups.map((group) => {
        const Icon = GROUP_ICONS[group.key];
        return (
          <VStack key={group.key} testID={`global-search-group-${group.key}`}>
            <Text className="px-2.5 pb-1 pt-2.5 text-xs font-semibold text-muted-ink">
              {t(`globalSearch.groups.${group.key}`)}
            </Text>
            {group.results.map((result) => {
              const active = result.key === activeKey;
              return (
                <Pressable
                  key={result.key}
                  nativeID={searchRowId(listId, result.key)}
                  testID="global-search-result"
                  role="option"
                  aria-selected={active}
                  accessibilityRole="button"
                  onPress={() => onSelect(result)}
                  onHoverIn={() => onHover(result)}
                  className={`min-h-11 justify-center rounded-control px-2.5 py-[9px] ${active ? "bg-neutral-wash" : ""}`}
                >
                  <HStack className="items-center gap-3">
                    <Icon size={18} color={icons.muted} />
                    <VStack className="min-w-0 flex-1">
                      <Highlighted text={result.title} query={query} className="text-sm text-ink" />
                      {result.subtitle ? (
                        <Highlighted text={result.subtitle} query={query} className="text-[13px] text-muted-ink" />
                      ) : null}
                    </VStack>
                    {result.amount ? (
                      <Box>
                        <Text className="text-sm font-bold tabular-nums text-ink">{result.amount}</Text>
                      </Box>
                    ) : null}
                  </HStack>
                </Pressable>
              );
            })}
          </VStack>
        );
      })}
    </VStack>
  );
}
