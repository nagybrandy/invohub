// components/settings/CopyableCredential.tsx
// Label + monospace value with one-click copy feedback.
import * as React from "react";
import { Copy, Check } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { copyText } from "@/lib/clipboard";
import { useIconColors } from "@/lib/theme/icon-colors";

type CopyableCredentialProps = {
  label: string;
  value: string;
  hint?: string;
};

export function CopyableCredential({ label, value, hint }: CopyableCredentialProps) {
  const icons = useIconColors();
  const [copied, setCopied] = React.useState(false);
  const copiedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    },
    []
  );

  async function handleCopy() {
    try {
      await copyText(value);
      setCopied(true);
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <VStack space="xs" className="w-full">
      <Text size="xs" className="font-medium text-muted-foreground">
        {label}
      </Text>
      <HStack className="items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
        <Text selectable size="xs" className="flex-1 break-all font-mono text-foreground">
          {value}
        </Text>
        <Button size="sm" variant="outline" onPress={() => void handleCopy()}>
          {copied ? <Check size={14} color={icons.muted} /> : <Copy size={14} color={icons.muted} />}
          <ButtonText>{copied ? "Copied" : "Copy"}</ButtonText>
        </Button>
      </HStack>
      {hint ? (
        <Text size="xs" className="text-muted-foreground">
          {hint}
        </Text>
      ) : null}
    </VStack>
  );
}
