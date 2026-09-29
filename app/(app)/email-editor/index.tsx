// app/(app)/email-editor/index.tsx
// Visual editor for the e-mails InvoHub sends (invoice, reminders, receipt,
// díjbekérő): pick the template, edit the subject and the body on a visual
// surface, watch the live preview with sample data, save. Its own menu item
// — the raw-HTML screen under Settings stays as a fallback.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { ChoicePill, ChoicePillGroup } from "@/components/ui/choice-pill";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { EmailBodyEditor } from "@/components/email/EmailBodyEditor";
import { EmailPreview } from "@/components/email/EmailPreview";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { htmlToText } from "@/lib/email/templates/editor";
import { useIsDesktop } from "@/lib/useIsDesktop";

export default function EmailEditorScreen() {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const { templates, loading, error, update } = useEmailTemplates();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

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
      setNotice(t("emailEditor.saved"));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("emailEditor.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const editor = (
    <VStack space="md" className="flex-1">
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText>{t("emailEditor.subject")}</FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField value={subject} onChangeText={setSubject} testID="email-subject" />
        </Input>
      </FormControl>
      <FormControl>
        <FormControlLabel>
          <FormControlLabelText>{t("emailEditor.body")}</FormControlLabelText>
        </FormControlLabel>
        <EmailBodyEditor value={bodyHtml} onChange={setBodyHtml} />
      </FormControl>
      <HStack space="sm" className="items-center">
        <Button onPress={() => void handleSave()} disabled={saving || !dirty} testID="email-save">
          {saving ? <ButtonSpinner /> : null}
          <ButtonText>{t("emailEditor.save")}</ButtonText>
        </Button>
        {notice ? <Text size="sm" className="text-muted-foreground" testID="email-notice">{notice}</Text> : null}
      </HStack>
    </VStack>
  );

  const preview = (
    <VStack space="xs" className="flex-1">
      <Text size="sm" className="font-medium text-muted-foreground">{t("emailEditor.preview")}</Text>
      <EmailPreview subject={subject} bodyHtml={bodyHtml} />
    </VStack>
  );

  return (
    <ScreenLayout
      width="full"
      header={<PageHeader title={t("emailEditor.title")} subtitle={t("emailEditor.subtitle")} />}
    >
      {loading ? (
        <StateView kind="loading" title="" />
      ) : error ? (
        <StateView kind="error" title={error} />
      ) : (
        <VStack space="lg">
          <ChoicePillGroup accessibilityLabel={t("emailEditor.templateType")}>
            {templates.map((tpl) => (
              <ChoicePill
                key={tpl.id}
                selected={tpl.id === selected?.id}
                onPress={() => setSelectedId(tpl.id)}
                testID={`email-template-${tpl.type}`}
              >
                <Text size="sm">{t(`emailEditor.types.${tpl.type}`)}</Text>
              </ChoicePill>
            ))}
          </ChoicePillGroup>
          {isDesktop ? (
            <HStack space="lg" className="items-start">
              {editor}
              {preview}
            </HStack>
          ) : (
            <VStack space="lg">
              {editor}
              {preview}
            </VStack>
          )}
        </VStack>
      )}
    </ScreenLayout>
  );
}
