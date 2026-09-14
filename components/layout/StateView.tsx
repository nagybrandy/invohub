// components/layout/StateView.tsx
// One component for empty / loading / error states. Loading renders a
// skeleton (gray pulse bars), never a spinner floating in empty space (4.7).
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

type StateViewProps = {
  kind: "empty" | "loading" | "error";
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** How many skeleton rows to render for kind="loading". */
  rows?: number;
};

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <VStack space="sm" testID="state-view-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
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
  retryLabel,
  rows = 5,
}: StateViewProps) {
  const icons = useIconColors();
  if (kind === "loading") {
    return (
      <Box className="py-2" testID="state-view-loading">
        <SkeletonRows rows={rows} />
      </Box>
    );
  }

  return (
    <VStack
      space="sm"
      className="items-center rounded-xl border border-subtle px-6 py-10"
      testID={`state-view-${kind}`}
    >
      {Icon ? (
        <Icon size={40} color={kind === "error" ? icons.destructive : icons.muted} />
      ) : null}
      <Heading size="md" className="text-center text-foreground">
        {title}
      </Heading>
      {description ? (
        <Text size="xs" className="text-center text-muted-foreground">
          {description}
        </Text>
      ) : null}
      {kind === "error" && onRetry ? (
        <Button variant="outline" onPress={onRetry}>
          <ButtonText>{retryLabel ?? "Retry"}</ButtonText>
        </Button>
      ) : null}
      {action ?? null}
    </VStack>
  );
}
