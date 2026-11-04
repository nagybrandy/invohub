// components/settings/CopyableCredential.tsx
// Label + monospace value with one-click copy feedback.
import * as React from "react";
import { Copy, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      <Text className="text-[13px] font-semibold text-ink">{label}</Text>
      <HStack className="items-center gap-2 rounded-control border border-line-strong bg-wash2 p-2 pl-3">
        <Text selectable className="min-w-0 flex-1 break-all font-mono text-xs text-ink">
          {value}
        </Text>
        <Button size="sm" variant="secondary" onPress={() => void handleCopy()}>
          {copied ? <Check size={14} color={icons.ok} /> : <Copy size={14} color={icons.muted} />}
          <ButtonText>{copied ? t("settingsPages.copied") : t("settingsPages.copy")}</ButtonText>
        </Button>
      </HStack>
      {hint ? <Text className="text-[13px] text-muted-ink">{hint}</Text> : null}
    </VStack>
  );
}
