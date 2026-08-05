// app/(app)/settings/templates.tsx
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";

export default function EmailTemplatesScreen() {
  const { t } = useTranslation();
  const { templates, loading, update } = useEmailTemplates();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  React.useEffect(() => {
    if (selected && selectedId !== selected.id) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

  React.useEffect(() => {
    if (selected) {
      setSubject(selected.subject);
      setBodyHtml(selected.bodyHtml);
    }
  }, [selected]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await update(selected.id, { subject, bodyHtml });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenLayout header={<Heading size="2xl">Email templates</Heading>}>
      <VStack space="md">
        <Text size="sm" className="text-muted-foreground">
          Variables: {"{{invoiceNumber}}"}, {"{{clientName}}"}, {"{{total}}"}, {"{{dueDate}}"}, {"{{paymentLink}}"}
        </Text>
        {loading ? (
          <Text>Loading…</Text>
        ) : (
          <>
            <VStack space="xs">
              {templates.map((tpl) => (
                <Button
                  key={tpl.id}
                  variant={selected?.id === tpl.id ? "default" : "outline"}
                  onPress={() => setSelectedId(tpl.id)}
                >
                  <ButtonText>{tpl.type.replace(/_/g, " ")}</ButtonText>
                </Button>
              ))}
            </VStack>
            {selected ? (
              <Card className="p-4">
                <VStack space="md">
                  <Input>
                    <InputField value={subject} onChangeText={setSubject} placeholder="Subject" />
                  </Input>
                  <Textarea>
                    <TextareaInput
                      value={bodyHtml}
                      onChangeText={setBodyHtml}
                      placeholder="HTML body"
                    />
                  </Textarea>
                  <Button onPress={handleSave} disabled={saving}>
                    <ButtonText>Save template</ButtonText>
                  </Button>
                </VStack>
              </Card>
            ) : null}
          </>
        )}
      </VStack>
    </ScreenLayout>
  );
}
