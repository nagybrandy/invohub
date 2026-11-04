// components/settings/SettingsSearchField.tsx
// "Keresés a beállításokban": the 40px search field of the settings nav and
// the phone start page (tokens.md §6.17). The ring sits on the field box.
import { TextInput } from "react-native";
import { Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { useIconColors } from "@/lib/theme/icon-colors";

export function SettingsSearchField({
  value,
  onChange,
  testID = "settings-search",
}: {
  value: string;
  onChange: (value: string) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  return (
    <Box className="focus-ring-host h-10 w-full flex-row items-center gap-2 rounded-[10px] border border-line-strong bg-surface pl-3 pr-2 web:focus-within:border-primary web:focus-within:outline web:focus-within:outline-2 web:focus-within:outline-primary">
      <Search size={16} color={icons.muted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={t("settingsPages.searchPlaceholder")}
        accessibilityLabel={t("settingsPages.searchLabel")}
        role="searchbox"
        autoCorrect={false}
        autoCapitalize="none"
        className="min-w-0 flex-1 py-0 text-sm text-ink placeholder:text-faint web:outline-none"
      />
      {value ? (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={t("settingsPages.searchClear")}
          onPress={() => onChange("")}
          className="h-7 w-7 items-center justify-center rounded-full data-[hover=true]:bg-neutral-wash"
        >
          <X size={14} color={icons.muted} />
        </Pressable>
      ) : null}
    </Box>
  );
}
