// app/(app)/settings/templates.tsx
// E-mailek szövege: pick one of the e-mails InvoHub sends (invoice, reminders,
// receipt, díjbekérő), edit its subject and body on a visual surface (the
// HTML source is one click away), and watch the preview with sample data.
// The type list sits beside the editor once the pane is >= 720px wide, a
// select above it otherwise. /email-editor redirects here.
import * as React from "react";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { FormField } from "@/components/layout/FormField";
import { StateView } from "@/components/layout/StateView";
import { EmailBodyEditor } from "@/components/email/EmailBodyEditor";
import { EmailPreview } from "@/components/email/EmailPreview";
import { SaveBar } from "@/components/settings/SaveBar";
import { SettingsNote, SettingsPage } from "@/components/settings/SettingsSheet";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { htmlToText } from "@/lib/email/templates/editor";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

/** Pane width from which the type list sits beside the editor (tokens.md §6.17). */
export const EMAIL_LIST_BESIDE_MIN = 720;

export default function EmailTemplatesScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const keys = settingsItemKeys("templates");
  const { templates, loading, error, update } = useEmailTemplates();
  const { width, measured, onLayout } = useMeasuredWidth();
  const listBeside = measured && width >= EMAIL_LIST_BESIDE_MIN;
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [htmlOpen, setHtmlOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const selected = templates.find((tpl) => tpl.id === selectedId) ?? templates[0];

  React.useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setSubject(selected.subject);
    setBodyHtml(selected.bodyHtml);
    setNotice(null);
    // Only when the selected template changes — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const dirty = !!selected && (subject !== selected.subject || bodyHtml !== selected.bodyHtml);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    try {
      await update(selected.id, { subject, bodyHtml, bodyText: htmlToText(bodyHtml) });
      setNotice({ kind: "ok", text: t("emailEditor.saved") });
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error && e.message ? e.message : t("emailEditor.saveFailed") });
    } finally {
      setSaving(false);
    }
  }

  const typeOptions = templates.map((tpl) => ({ value: tpl.id, label: t(`emailEditor.types.${tpl.type}`) }));

  const typeList = (
    <Box
      testID="email-type-list"
      accessibilityRole="radiogroup"
      accessibilityLabel={t("emailEditor.templateType")}
      className="w-[200px] shrink-0 gap-0.5"
    >
      {templates.map((tpl) => {
        const active = tpl.id === selected?.id;
        return (
          <Pressable
            key={tpl.id}
            testID={`email-template-${tpl.type}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, selected: active }}
            aria-checked={active}
            onPress={() => setSelectedId(tpl.id)}
            className={`min-h-[42px] flex-row items-center rounded-control px-3 py-2.5 ${
              active ? "bg-surface shadow-card" : "data-[hover=true]:bg-neutral-wash"
            }`}
          >
            <Text className={`min-w-0 flex-1 text-sm leading-[1.3] ${active ? "font-semibold text-primary-ink" : "font-medium text-ink"}`}>
              {t(`emailEditor.types.${tpl.type}`)}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );

  const editorCard = selected ? (
    <Box testID="email-editor-card" className="min-w-0 flex-1 overflow-hidden rounded-card bg-surface shadow-card">
      <Box className="gap-4 px-4 py-5 tab:px-6 tab:py-[22px]">
        <Box>
          <Text className={type.itemTitle}>{t(`emailEditor.types.${selected.type}`)}</Text>
          <Text className={`${type.meta} mt-1`}>{t(`settingsPages.templates.typeHints.${selected.type}`)}</Text>
        </Box>
        <FormField label={t("emailEditor.subject")}>
          <Input>
            <InputField
              value={subject}
              onChangeText={setSubject}
              testID="email-subject"
              accessibilityLabel={t("emailEditor.subject")}
            />
          </Input>
        </FormField>
        <FormField label={t("settingsPages.templates.bodyLabel")}>
          <EmailBodyEditor value={bodyHtml} onChange={setBodyHtml} />
        </FormField>
        <Box>
          <Pressable
            testID="email-html-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: htmlOpen }}
            onPress={() => setHtmlOpen((open) => !open)}
            className="min-h-10 flex-row items-center gap-1.5 self-start"
          >
            <Box className={htmlOpen ? "rotate-90" : ""}>
              <ChevronRight size={16} color={icons.accentForeground} />
            </Box>
            <Text className="text-sm font-semibold text-primary-ink">{t("settingsPages.templates.advanced")}</Text>
          </Pressable>
          {htmlOpen ? (
            <Textarea className="mt-2">
              <TextareaInput
                testID="email-html"
                accessibilityLabel={t("settingsPages.templates.advanced")}
                value={bodyHtml}
                onChangeText={setBodyHtml}
                placeholder="<p>…</p>"
                className="font-mono text-[13px]"
              />
            </Textarea>
          ) : null}
        </Box>
      </Box>
      <Box aria-hidden className="h-px bg-line" />
      <Box className="gap-3 px-4 py-5 tab:px-6 tab:py-[22px]">
        <Box>
          <Text className={type.itemTitle}>{t("emailEditor.preview")}</Text>
          <Text className={`${type.meta} mt-1`}>{t("settingsPages.templates.previewHint")}</Text>
        </Box>
        <EmailPreview subject={subject} bodyHtml={bodyHtml} />
      </Box>
    </Box>
  ) : null;

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-templates">
      <Box onLayout={onLayout} className="w-full min-w-0" testID="email-pane">
        {loading && templates.length === 0 ? (
          <StateView kind="loading" title="" />
        ) : error ? (
          <StateView kind="error" title={error} />
        ) : templates.length === 0 ? (
          <Text className={type.meta}>{t("settingsPages.templates.empty")}</Text>
        ) : listBeside ? (
          <Box className="flex-row items-start gap-5">
            {typeList}
            {editorCard}
          </Box>
        ) : (
          <Box className="gap-4">
            <FormField label={t("settingsPages.templates.typeSelectLabel")}>
              <Select<string>
                testID="email-type-select"
                accessibilityLabel={t("settingsPages.templates.typeSelectLabel")}
                value={selected?.id ?? ""}
                options={typeOptions}
                onChange={setSelectedId}
              />
            </FormField>
            {editorCard}
          </Box>
        )}
      </Box>

      {notice ? (
        <SettingsNote tone={notice.kind === "ok" ? "ok" : "err"} testID="email-notice">
          {notice.text}
        </SettingsNote>
      ) : null}

      <SaveBar
        visible={dirty || saving}
        saving={saving}
        onSave={() => void handleSave()}
        onDiscard={() => {
          if (!selected) return;
          setSubject(selected.subject);
          setBodyHtml(selected.bodyHtml);
        }}
        saveLabel={t("emailEditor.save")}
        saveTestID="email-save"
      />
    </SettingsPage>
  );
}
