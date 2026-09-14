// components/layout/StateView.tsx
// One component for empty / loading / error states across the app (§4.7).
// loading renders a skeleton, never an ActivityIndicator floating in the
// void (V11); error always offers a retry action.
import type { ComponentType, ReactNode } from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react-native";

export type StateViewKind = "empty" | "loading" | "error";

export type StateViewProps = {
  kind: StateViewKind;
  icon?: LucideIcon | ComponentType<{ size?: number; className?: string }>;
  /** Required for empty/error; ignored for loading. */
  title?: string;
  description?: string;
  action?: ReactNode;
  /** kind="error" only — renders a "Retry" button. */
  onRetry?: () => void;
  /** Number of skeleton rows/lines for kind="loading". Default 5. */
  skeletonRows?: number;
  className?: string;
};

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <VStack testID="state-view-skeleton" space="sm" className="w-full py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          className="h-12 w-full animate-pulse rounded-lg bg-muted"
        />
      ))}
    </VStack>
  );
}

export function StateView({
  kind,
  icon: Icon,
  title,
  description,
  action,
  onRetry,
  skeletonRows = 5,
  className = "",
}: StateViewProps) {
  const { t } = useTranslation();

  if (kind === "loading") {
    return (
      <Box testID="state-view-loading" className={`w-full items-center py-4 ${className}`.trim()}>
        <SkeletonRows rows={skeletonRows} />
      </Box>
    );
  }

  const resolvedTitle =
    title ?? (kind === "error" ? t("states.errorTitle") : t("states.emptyTitle"));
  const resolvedDescription =
    description ?? (kind === "error" ? t("states.errorDescription") : undefined);

  return (
    <Box
      testID={kind === "error" ? "state-view-error" : "state-view-empty"}
      className={`w-full items-center px-6 py-16 ${className}`.trim()}
    >
      <VStack space="md" className="max-w-sm items-center">
        {Icon ? (
          <Icon
            size={40}
            className={kind === "error" ? "text-destructive" : "text-muted-foreground/60"}
          />
        ) : null}
        <Heading size="sm" className="text-center text-foreground">
          {resolvedTitle}
        </Heading>
        {resolvedDescription ? (
          <Text size="xs" className="text-center text-muted-foreground">
            {resolvedDescription}
          </Text>
        ) : null}
        {kind === "error" && onRetry ? (
          <Button testID="state-view-retry" variant="outline" onPress={onRetry}>
            <ButtonText>{t("common.retry")}</ButtonText>
          </Button>
        ) : (
          action ?? null
        )}
      </VStack>
    </Box>
  );
}
