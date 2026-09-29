// components/email/EmailBodyEditor.tsx
// Native fallback for the e-mail body editor: the HTML source in a textarea,
// with the placeholder chips appending at the end. The visual (WYSIWYG)
// surface is web-only — EmailBodyEditor.web.tsx.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { ChoicePill, ChoicePillGroup } from "@/components/ui/choice-pill";
import { placeholder, TEMPLATE_VARIABLE_KEYS } from "@/lib/email/templates/editor";

export type EmailBodyEditorProps = {
  value: string;
  onChange: (html: string) => void;
  testID?: string;
};

export function EmailBodyEditor({ value, onChange, testID = "email-body-editor" }: EmailBodyEditorProps) {
  const { t } = useTranslation();
  return (
    <VStack space="sm">
      <HStack space="sm" className="flex-wrap items-center">
        <Text size="xs" className="text-muted-foreground">{t("emailEditor.insertVariable")}</Text>
        <ChoicePillGroup>
          {TEMPLATE_VARIABLE_KEYS.map((key) => (
            <ChoicePill key={key} selected={false} onPress={() => onChange(`${value}${placeholder(key)}`)} testID={`email-var-${key}`}>
              <Text size="xs">{t(`emailEditor.variables.${key}`)}</Text>
            </ChoicePill>
          ))}
        </ChoicePillGroup>
      </HStack>
      <Textarea>
        <TextareaInput value={value} onChangeText={onChange} testID={testID} placeholder="<p>…</p>" />
      </Textarea>
      <Text size="xs" className="text-muted-foreground">{t("emailEditor.nativeHint")}</Text>
    </VStack>
  );
}
