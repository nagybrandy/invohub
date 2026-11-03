// app/(app)/settings/pdf.tsx
// Számla testreszabása: the invoice PDF's real template options (document
// title, accent colour, font size, three show/hide switches, notes label,
// footer text) with a live sample preview. The preview sits beside the form
// once the pane is >= 760px wide (sticky); below that an Előnézet button
// reveals it above the form. Save/preview calls are unchanged
// (PATCH / POST /api/pdf-template).
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { FormField } from "@/components/layout/FormField";
import { AccentSwatches } from "@/components/settings/AccentSwatches";
import { PdfPreviewPanel } from "@/components/settings/PdfPreviewPanel";
import { SaveBar } from "@/components/settings/SaveBar";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { usePdfTemplate } from "@/hooks/usePdfTemplate";
import { DEFAULT_PDF_TEMPLATE, PDF_FONT_SCALES } from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate, PdfFontScale } from "@/lib/invoices/pdf-template/types";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { LAYOUT } from "@/lib/theme/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

const FONT_LABELS: Record<PdfFontScale, string> = { small: "S", medium: "M", large: "L" };

const TEMPLATE_KEYS = Object.keys(DEFAULT_PDF_TEMPLATE) as Array<keyof InvoicePdfTemplate>;

function ToggleRow({
  label,
  value,
  onChange,
  testID,
  last = false,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
  last?: boolean;
}) {
  return (
    <Box className={`min-h-[48px] flex-row items-center justify-between gap-3 ${last ? "" : "border-b border-line"}`}>
      <Text className={`${type.itemTitle} min-w-0 flex-1`}>{label}</Text>
      <Switch testID={testID} value={value} onValueChange={onChange} accessibilityLabel={label} />
    </Box>
  );
}

export default function PdfSettingsScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { template, loading, save, previewSample } = usePdfTemplate();
  const keys = settingsItemKeys("pdf");
  const [draft, setDraft] = React.useState<InvoicePdfTemplate>(DEFAULT_PDF_TEMPLATE);
  const [saving, setSaving] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { width, measured, onLayout } = useMeasuredWidth();
  const beside = measured && width >= LAYOUT.previewBesideMin;

  React.useEffect(() => {
    if (template) setDraft(template);
  }, [template]);

  function updateDraft(partial: Partial<InvoicePdfTemplate>) {
    setMessage(null);
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  const saved = template ?? DEFAULT_PDF_TEMPLATE;
  const dirty = Boolean(template) && TEMPLATE_KEYS.some((key) => draft[key] !== saved[key]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await save(draft);
      setMessage(t("settings.pdfScreen.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.pdfScreen.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const form = (
    <SettingsSheet>
      <SettingsSection title={t("settings.pdfScreen.documentTitle")} hint={t("settingsPages.pdf.titleHint")}>
        <Input>
          <InputField
            testID="pdf-title"
            accessibilityLabel={t("settings.pdfScreen.documentTitle")}
            value={draft.titleText}
            onChangeText={(v) => updateDraft({ titleText: v })}
            placeholder="SZÁMLA"
          />
        </Input>
      </SettingsSection>

      <SettingsSection title={t("settingsPages.pdf.accentTitle")} hint={t("settingsPages.pdf.accentHint")}>
        <AccentSwatches
          value={draft.accentColor}
          onChange={(hex) => updateDraft({ accentColor: hex })}
          accessibilityLabel={t("settings.pdfScreen.accentColor")}
        />
        <FormField label={t("settingsPages.pdf.accentCustom")}>
          <Box className="flex-row items-center gap-2">
            <Input className="min-w-0 flex-1">
              <InputField
                testID="pdf-accent-hex"
                accessibilityLabel={t("settingsPages.pdf.accentCustom")}
                value={draft.accentColor}
                onChangeText={(v) => updateDraft({ accentColor: v })}
                placeholder="#4f46e5"
                autoCapitalize="none"
              />
            </Input>
            <Box
              aria-hidden
              testID="pdf-accent-sample"
              className="h-[42px] w-[42px] rounded-control border border-line-strong"
              style={{ backgroundColor: draft.accentColor }}
            />
          </Box>
        </FormField>
      </SettingsSection>

      <SettingsSection title={t("settingsPages.pdf.fontTitle")} hint={t("settingsPages.pdf.fontHint")}>
        <SegmentedControl<PdfFontScale>
          outlined
          testID="pdf-font-scale"
          accessibilityLabel={t("settings.pdfScreen.fontSize")}
          value={draft.fontScale}
          onChange={(scale) => updateDraft({ fontScale: scale })}
          options={PDF_FONT_SCALES.map((scale) => ({
            value: scale,
            label: FONT_LABELS[scale],
            accessibilityLabel: t(`settingsPages.pdf.fontSizes.${scale}`),
            testID: `pdf-font-scale-${scale}`,
          }))}
        />
      </SettingsSection>

      <SettingsSection title={t("settingsPages.pdf.visibleTitle")} hint={t("settingsPages.pdf.visibleHint")}>
        <Box>
          <ToggleRow
            testID="pdf-show-company"
            label={t("settings.pdfScreen.showCompanyBlock")}
            value={draft.showCompanyBlock}
            onChange={(v) => updateDraft({ showCompanyBlock: v })}
          />
          <ToggleRow
            testID="pdf-show-bank"
            label={t("settings.pdfScreen.showBankDetails")}
            value={draft.showBankDetails}
            onChange={(v) => updateDraft({ showBankDetails: v })}
          />
          <ToggleRow
            testID="pdf-show-client-tax"
            last
            label={t("settings.pdfScreen.showClientTaxNumber")}
            value={draft.showClientTaxNumber}
            onChange={(v) => updateDraft({ showClientTaxNumber: v })}
          />
        </Box>
      </SettingsSection>

      <SettingsSection title={t("settings.pdfScreen.notesLabel")} hint={t("settingsPages.pdf.notesHint")}>
        <Input>
          <InputField
            testID="pdf-notes-label"
            accessibilityLabel={t("settings.pdfScreen.notesLabel")}
            value={draft.notesLabel}
            onChangeText={(v) => updateDraft({ notesLabel: v })}
            placeholder="Notes"
          />
        </Input>
      </SettingsSection>

      <SettingsSection title={t("settings.pdfScreen.footerText")} hint={t("settingsPages.pdf.footerHint")}>
        <Textarea>
          <TextareaInput
            testID="pdf-footer-text"
            accessibilityLabel={t("settings.pdfScreen.footerText")}
            value={draft.footerText}
            onChangeText={(v) => updateDraft({ footerText: v })}
            placeholder={t("settings.pdfScreen.footerTextPlaceholder")}
          />
        </Textarea>
      </SettingsSection>
    </SettingsSheet>
  );

  const preview = (
    <PdfPreviewPanel
      draft={draft}
      render={previewSample}
      enabled={!loading && (beside || previewOpen)}
    />
  );

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-pdf">
      <Box onLayout={onLayout} className="w-full min-w-0 gap-4" testID="pdf-pane">
        {loading ? (
          <ActivityIndicator />
        ) : beside ? (
          <Box className="flex-row items-start gap-4">
            <Box className="min-w-0 flex-1">{form}</Box>
            <Box className="min-w-[390px] shrink-0 web:sticky web:top-6" style={{ width: "50%" }} testID="pdf-preview-column">
              {preview}
            </Box>
          </Box>
        ) : (
          <>
            <Box className="flex-row">
              <Button
                variant="secondary"
                onPress={() => setPreviewOpen((open) => !open)}
                testID="pdf-preview-toggle"
                accessibilityState={{ expanded: previewOpen }}
              >
                {previewOpen ? <EyeOff size={16} color={icons.foreground} /> : <Eye size={16} color={icons.foreground} />}
                <ButtonText>{previewOpen ? t("settingsPages.pdf.hidePreview") : t("settingsPages.pdf.showPreview")}</ButtonText>
              </Button>
            </Box>
            {previewOpen ? preview : null}
            {form}
          </>
        )}
      </Box>

      {message ? <SettingsNote tone="ok" testID="pdf-message">{message}</SettingsNote> : null}
      {error ? <SettingsNote tone="err" testID="pdf-error">{error}</SettingsNote> : null}

      <SaveBar
        visible={dirty || saving}
        saving={saving}
        onSave={() => void handleSave()}
        onDiscard={() => setDraft(saved)}
        saveLabel={t("settings.pdfScreen.save")}
        saveTestID="pdf-save"
      />
    </SettingsPage>
  );
}
