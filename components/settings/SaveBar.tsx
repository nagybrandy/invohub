// components/settings/SaveBar.tsx
// Sticky save bar for settings pages with an explicit save (tokens.md §6.17):
// it only exists while there are unsaved changes, sits at the bottom of the
// pane, shows the "unsaved" label on the left and Elvetés / Mentés on the
// right (phone: the label is hidden and the buttons share the row).
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export type SaveBarProps = {
  /** Show the bar (the page has unsaved changes). */
  visible: boolean;
  onSave: () => void;
  /** Revert the form to what is saved; omit to hide the Elvetés button. */
  onDiscard?: () => void;
  saving?: boolean;
  /** Block saving (invalid input) without hiding the bar. */
  saveDisabled?: boolean;
  saveLabel?: string;
  testID?: string;
  saveTestID?: string;
  discardTestID?: string;
};

export function SaveBar({
  visible,
  onSave,
  onDiscard,
  saving = false,
  saveDisabled = false,
  saveLabel,
  testID = "settings-save-bar",
  saveTestID = "settings-save",
  discardTestID = "settings-discard",
}: SaveBarProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <Box
      testID={testID}
      accessibilityRole="toolbar"
      className="z-10 mt-4 w-full flex-row items-center gap-3 rounded-card border border-line-strong bg-surface px-4 py-3 shadow-menu web:sticky web:bottom-4"
    >
      <Text className="flex-1 text-sm font-semibold text-ink phone:hidden" testID={`${testID}-label`}>
        {t("settingsPages.unsaved")}
      </Text>
      {onDiscard ? (
        <Button
          variant="secondary"
          onPress={onDiscard}
          disabled={saving}
          testID={discardTestID}
          className="phone:flex-1"
        >
          <ButtonText>{t("settingsPages.discard")}</ButtonText>
        </Button>
      ) : null}
      <Button
        variant="primary"
        onPress={onSave}
        disabled={saving || saveDisabled}
        testID={saveTestID}
        className="phone:flex-1"
      >
        {saving ? <ButtonSpinner /> : null}
        <ButtonText>{saving ? t("common.saving") : (saveLabel ?? t("settingsPages.saveChanges"))}</ButtonText>
      </Button>
    </Box>
  );
}
