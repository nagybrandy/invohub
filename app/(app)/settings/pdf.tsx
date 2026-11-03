// app/(app)/settings/pdf.tsx
// Számla testreszabása (Dóri's screen): the invoice PDF's real template
// options - logo (mode / size / position), brand colour, font style, layout,
// the three show/hide switches, notes label and footer text - with a live
// preview that IS the PDF (POST /api/pdf-template renders the sample invoice
// from the unsaved draft). The preview sits beside the form once the pane is
// >= 760px wide (sticky); below that an Előnézet button reveals it above the
// form. Save is PATCH /api/pdf-template (validated server side).
//
// A user who still has the legacy layout keeps it (shown as "Korábbi") until
// they choose a new one; nothing here migrates the stored layout silently.
// The buyer tax number is always printed on the new layouts, so that switch is
// locked there.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { Eye, EyeOff, RotateCcw } from "lucide-react-native";
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
import { LayoutThumb, PdfOptionCards } from "@/components/settings/PdfOptionCards";
import { PdfPreviewPanel } from "@/components/settings/PdfPreviewPanel";
import { SaveBar } from "@/components/settings/SaveBar";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { usePdfTemplate } from "@/hooks/usePdfTemplate";
import { darkOf } from "@/lib/invoices/paper/brand-color";
import {
  applyPdfTemplateInput,
  DEFAULT_PDF_TEMPLATE,
  PDF_FONT_SCALES,
} from "@/lib/invoices/pdf-template/defaults";
import type {
  InvoicePdfTemplate,
  PdfFontScale,
  PdfFontStyle,
  PdfLayout,
  PdfLogoMode,
  PdfLogoPosition,
  PdfLogoSize,
} from "@/lib/invoices/pdf-template/types";
import {
  PDF_FOOTER_MAX_LENGTH,
  PDF_NOTES_LABEL_MAX_LENGTH,
  PDF_TITLE_MAX_LENGTH,
} from "@/lib/invoices/pdf-template/validate";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { LAYOUT } from "@/lib/theme/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

const FONT_LABELS: Record<PdfFontScale, string> = { small: "S", medium: "M", large: "L" };

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const LOGO_SIZES: PdfLogoSize[] = ["S", "M", "L"];
const LOGO_POSITIONS: PdfLogoPosition[] = ["left", "right"];
const FONT_STYLES: PdfFontStyle[] = ["invohub", "classic", "round"];
const NEW_LAYOUTS: PdfLayout[] = ["clean", "band", "frame"];

const TEMPLATE_KEYS = Object.keys(DEFAULT_PDF_TEMPLATE) as Array<keyof InvoicePdfTemplate>;

function expandHex(hex: string): string {
  const [, r, g, b] = hex.trim();
  return `#${r}${r}${g}${g}${b}${b}`;
}

function ToggleRow({
  label,
  value,
  onChange,
  testID,
  last = false,
  disabled = false,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
  last?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Box className={`min-h-[48px] flex-row items-center justify-between gap-3 py-1 ${last ? "" : "border-b border-line"}`}>
      <Box className="min-w-0 flex-1">
        <Text className={type.itemTitle}>{label}</Text>
        {hint ? (
          <Text testID={`${testID}-hint`} className={type.meta}>
            {hint}
          </Text>
        ) : null}
      </Box>
      <Switch testID={testID} value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={label} />
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
  const legacyUser = saved.layout === "legacy";
  const onLegacy = draft.layout === "legacy";
  const colorValid = HEX_COLOR.test(draft.accentColor.trim());
  // The server rejects a malformed colour, so the preview keeps the last good one.
  const previewDraft = React.useMemo(
    () => (colorValid ? draft : { ...draft, accentColor: saved.accentColor }),
    [colorValid, draft, saved.accentColor]
  );
  const colorHex = colorValid ? (draft.accentColor.trim().length === 4 ? expandHex(draft.accentColor) : draft.accentColor.trim()) : null;
  // The header uses a darker shade of a light colour (contrast); say so.
  const shade = colorHex && !onLegacy ? darkOf(colorHex) : null;
  const showShade = shade !== null && colorHex !== null && shade.toLowerCase() !== colorHex.toLowerCase();

  function chooseLayout(layout: PdfLayout) {
    setMessage(null);
    if (layout === "legacy") {
      // Back to exactly what is stored (only offered while the stored layout is legacy).
      setDraft(saved);
    } else if (draft.layout === "legacy") {
      // Leaving legacy: values the user never changed take Dóri's defaults.
      setDraft((prev) => applyPdfTemplateInput(prev, { layout }));
    } else {
      setDraft((prev) => ({ ...prev, layout }));
    }
  }

  function handleReset() {
    setMessage(t("settings.pdfScreen.resetDone"));
    setError(null);
    setDraft({ ...DEFAULT_PDF_TEMPLATE });
  }

  async function handleSave() {
    if (!colorValid) {
      setError(t("settings.pdfScreen.colorInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await save({ ...draft, accentColor: draft.accentColor.trim() });
      setMessage(t("settings.pdfScreen.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.pdfScreen.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const accentForThumbs = colorValid ? draft.accentColor.trim() : saved.accentColor;
  const layoutOptions: PdfLayout[] = legacyUser ? ["legacy", ...NEW_LAYOUTS] : NEW_LAYOUTS;
  const layoutLabel: Record<PdfLayout, string> = {
    legacy: t("settings.pdfScreen.layoutLegacy"),
    clean: t("settings.pdfScreen.layoutClean"),
    band: t("settings.pdfScreen.layoutBand"),
    frame: t("settings.pdfScreen.layoutFrame"),
  };
  const fontLabel: Record<PdfFontStyle, string> = {
    invohub: t("settings.pdfScreen.fontInvohub"),
    classic: t("settings.pdfScreen.fontClassic"),
    round: t("settings.pdfScreen.fontRound"),
  };

  const form = (
    <SettingsSheet>
      <SettingsSection title={t("settings.pdfScreen.documentTitle")} hint={t("settingsPages.pdf.titleHint")}>
        <Input>
          <InputField
            testID="pdf-title"
            accessibilityLabel={t("settings.pdfScreen.documentTitle")}
            value={draft.titleText}
            maxLength={PDF_TITLE_MAX_LENGTH}
            onChangeText={(v) => updateDraft({ titleText: v })}
            placeholder="SZÁMLA"
          />
        </Input>
      </SettingsSection>

      {onLegacy ? null : (
        <SettingsSection title={t("settings.pdfScreen.logo")} hint={t("settings.pdfScreen.logoHint")}>
          <SegmentedControl<PdfLogoMode>
            outlined
            testID="pdf-logo-mode"
            accessibilityLabel={t("settings.pdfScreen.logo")}
            value={draft.logoMode}
            onChange={(logoMode) => updateDraft({ logoMode })}
            options={[
              { value: "monogram", label: t("settings.pdfScreen.logoMonogram"), testID: "pdf-logo-mode-monogram" },
              { value: "own", label: t("settings.pdfScreen.logoOwn"), disabled: true, testID: "pdf-logo-mode-own" },
              { value: "none", label: t("settings.pdfScreen.logoNone"), testID: "pdf-logo-mode-none" },
            ]}
          />
          <Text testID="pdf-logo-own-hint" className={type.meta}>
            {t("settings.pdfScreen.logoOwnHint")}
          </Text>
          {draft.logoMode === "none" ? null : (
            <Box className="flex-row flex-wrap gap-4">
              <Box className="min-w-[140px] flex-1 gap-1.5">
                <Text className={type.meta}>{t("settings.pdfScreen.logoSize")}</Text>
                <SegmentedControl<PdfLogoSize>
                  outlined
                  testID="pdf-logo-size"
                  accessibilityLabel={t("settings.pdfScreen.logoSize")}
                  value={draft.logoSize}
                  onChange={(logoSize) => updateDraft({ logoSize })}
                  options={LOGO_SIZES.map((size) => ({ value: size, label: size, testID: `pdf-logo-size-${size}` }))}
                />
              </Box>
              <Box className="min-w-[160px] flex-1 gap-1.5">
                <Text className={type.meta}>{t("settings.pdfScreen.logoPosition")}</Text>
                <SegmentedControl<PdfLogoPosition>
                  outlined
                  testID="pdf-logo-position"
                  accessibilityLabel={t("settings.pdfScreen.logoPosition")}
                  value={draft.logoPosition}
                  onChange={(logoPosition) => updateDraft({ logoPosition })}
                  options={LOGO_POSITIONS.map((pos) => ({
                    value: pos,
                    label: t(pos === "left" ? "settings.pdfScreen.logoLeft" : "settings.pdfScreen.logoRight"),
                    testID: `pdf-logo-position-${pos}`,
                  }))}
                />
              </Box>
            </Box>
          )}
        </SettingsSection>
      )}

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
                placeholder="#3F6BC4"
                autoCapitalize="none"
              />
            </Input>
            <Box
              aria-hidden
              testID="pdf-accent-sample"
              className="h-[42px] w-[42px] rounded-control border border-line-strong"
              style={{ backgroundColor: accentForThumbs }}
            />
          </Box>
        </FormField>
        {colorValid ? null : (
          <Text testID="pdf-accent-error" accessibilityRole="alert" className="text-sm text-err">
            {t("settings.pdfScreen.colorInvalid")}
          </Text>
        )}
        {showShade && shade ? (
          <Text testID="pdf-accent-shade" className={type.meta}>
            {t("settings.pdfScreen.shadeNote", { hex: shade })}
          </Text>
        ) : null}
      </SettingsSection>

      {onLegacy ? (
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
      ) : (
        <SettingsSection title={t("settings.pdfScreen.fontStyle")} hint={t("settings.pdfScreen.fontStyleHint")}>
          <PdfOptionCards<PdfFontStyle>
            testID="pdf-font-style"
            accessibilityLabel={t("settings.pdfScreen.fontStyle")}
            value={draft.fontStyle}
            onChange={(fontStyle) => updateDraft({ fontStyle })}
            options={FONT_STYLES.map((style) => ({
              value: style,
              label: fontLabel[style],
              sample: (
                <Box aria-hidden className="items-center">
                  <Text className="text-base font-bold text-ink">{t("settings.pdfScreen.fontSampleHeading")}</Text>
                  <Text className={`${type.meta} ${type.money}`}>1 234 567</Text>
                </Box>
              ),
            }))}
          />
        </SettingsSection>
      )}

      <SettingsSection title={t("settings.pdfScreen.layout")} hint={t("settings.pdfScreen.layoutHint")}>
        <PdfOptionCards<PdfLayout>
          testID="pdf-layout"
          accessibilityLabel={t("settings.pdfScreen.layout")}
          value={draft.layout}
          onChange={chooseLayout}
          options={layoutOptions.map((layout) => ({
            value: layout,
            label: layoutLabel[layout],
            sample: <LayoutThumb layout={layout} color={accentForThumbs} />,
          }))}
        />
        {onLegacy ? (
          <Text testID="pdf-layout-legacy-note" className={type.meta}>
            {t("settings.pdfScreen.layoutLegacyNote")}
          </Text>
        ) : null}
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
            value={onLegacy ? draft.showClientTaxNumber : true}
            disabled={!onLegacy}
            hint={onLegacy ? undefined : t("settings.pdfScreen.clientTaxLocked")}
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
            maxLength={PDF_NOTES_LABEL_MAX_LENGTH}
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
            maxLength={PDF_FOOTER_MAX_LENGTH}
            onChangeText={(v) => updateDraft({ footerText: v })}
            placeholder={t("settings.pdfScreen.footerTextPlaceholder")}
          />
        </Textarea>
      </SettingsSection>

      <Box className="flex-row px-4 py-4 tab:px-6">
        <Button variant="tertiary" onPress={handleReset} testID="pdf-reset">
          <RotateCcw size={16} color={icons.foreground} />
          <ButtonText>{t("settings.pdfScreen.resetDefaults")}</ButtonText>
        </Button>
      </Box>
    </SettingsSheet>
  );

  const preview = (
    <PdfPreviewPanel
      draft={previewDraft}
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
        testID="pdf-save-bar"
        visible={dirty || saving}
        saving={saving}
        saveDisabled={!colorValid}
        onSave={() => void handleSave()}
        onDiscard={() => setDraft(saved)}
        saveLabel={t("settings.pdfScreen.save")}
        saveTestID="pdf-save"
      />
    </SettingsPage>
  );
}
