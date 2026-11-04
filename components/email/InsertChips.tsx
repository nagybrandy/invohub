// components/email/InsertChips.tsx
// "Beszúrás:" + one dashed pill per placeholder the mail renderer knows
// (TEMPLATE_VARIABLE_KEYS); pressing one inserts {{variable}} through
// `onInsert`. Only existing placeholders are offered (tokens.md §6.17).
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { placeholder, TEMPLATE_VARIABLE_KEYS } from "@/lib/email/templates/editor";

export function InsertChips({ onInsert }: { onInsert: (text: string) => void }) {
  const { t } = useTranslation();
  return (
    <Box className="flex-row flex-wrap items-center gap-2" testID="email-insert-chips">
      <Text className="text-[13px] text-muted-ink">{t("emailEditor.insertVariable")}</Text>
      {TEMPLATE_VARIABLE_KEYS.map((key) => (
        <Pressable
          key={key}
          testID={`email-var-${key}`}
          accessibilityRole="button"
          accessibilityLabel={`${t("emailEditor.insertVariable")} ${t(`emailEditor.variables.${key}`)}`}
          onPress={() => onInsert(placeholder(key))}
          className="min-h-[30px] items-center justify-center rounded-full border border-dashed border-primary-line bg-wash2 px-3 data-[hover=true]:bg-primary-wash"
        >
          <Text className="text-[13px] font-semibold text-primary-ink">{t(`emailEditor.variables.${key}`)}</Text>
        </Pressable>
      ))}
    </Box>
  );
}
