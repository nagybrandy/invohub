// components/email/EmailBodyEditor.tsx
// Native fallback for the e-mail body editor: the HTML source in a textarea,
// with the placeholder chips appending at the end. The visual (WYSIWYG)
// surface is web-only — EmailBodyEditor.web.tsx.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { InsertChips } from "@/components/email/InsertChips";

export type EmailBodyEditorProps = {
  value: string;
  onChange: (html: string) => void;
  testID?: string;
};

export function EmailBodyEditor({ value, onChange, testID = "email-body-editor" }: EmailBodyEditorProps) {
  const { t } = useTranslation();
  return (
    <Box className="gap-3">
      <InsertChips onInsert={(text) => onChange(`${value}${text}`)} />
      <Textarea>
        <TextareaInput value={value} onChangeText={onChange} testID={testID} placeholder="<p>…</p>" />
      </Textarea>
      <Text className="text-[13px] text-muted-ink">{t("emailEditor.nativeHint")}</Text>
    </Box>
  );
}
