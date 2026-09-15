// components/layout/ListScreen.tsx
// FlatList wrapper with empty state, refresh, and loading skeleton.
import type { ReactElement, ReactNode } from "react";
import { FlatList, RefreshControl, type ListRenderItem } from "react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { EmptyState } from "@/components/layout/EmptyState";
import { ScreenLayout } from "@/components/layout/ScreenLayout";

type ListScreenProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: ListRenderItem<T>;
  header?: ReactNode;
  /** Defaults to the states.emptyTitle i18n key — never a hardcoded string (V11). */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function ListScreen<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  emptyTitle,
  emptyDescription,
  emptyAction,
  loading = false,
  refreshing = false,
  onRefresh,
}: ListScreenProps<T>): ReactElement {
  const { t } = useTranslation();
  const resolvedEmptyTitle = emptyTitle ?? t("states.emptyTitle");

  if (loading && data.length === 0) {
    return (
      <ScreenLayout scroll={false}>
        <EmptyState title={resolvedEmptyTitle} loading />
      </ScreenLayout>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <ScreenLayout scroll={false}>
        {header ? <Box className="mb-4">{header}</Box> : null}
        <EmptyState
          title={resolvedEmptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </ScreenLayout>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      className="flex-1 bg-background"
      contentContainerClassName="gap-3 px-4 pb-10 pt-5 md:px-10 md:pt-8"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      ListHeaderComponent={header ? <>{header}</> : undefined}
    />
  );
}
