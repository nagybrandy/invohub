// components/email/EmailBodyEditor.web.tsx
// The visual e-mail body editor: a contentEditable surface with a small
// toolbar (bold, italic, list, link) and one chip per placeholder that
// inserts {{variable}} at the caret. The value in and out is the same
// bodyHtml the mail sender renders — what you see is what gets sent.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bold, Italic, Link, List } from "lucide-react-native";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ChoicePill, ChoicePillGroup } from "@/components/ui/choice-pill";
import { useIconColors } from "@/lib/theme/icon-colors";
import { TAP_TARGET_ICON_BOX } from "@/lib/ui/tap-target";
import { placeholder, TEMPLATE_VARIABLE_KEYS } from "@/lib/email/templates/editor";
import type { EmailBodyEditorProps } from "@/components/email/EmailBodyEditor";

export type { EmailBodyEditorProps };

const TOOLS: { key: string; icon: React.ComponentType<{ size?: number; color?: string }>; command: string; labelKey: string }[] = [
  { key: "bold", icon: Bold, command: "bold", labelKey: "emailEditor.toolbar.bold" },
  { key: "italic", icon: Italic, command: "italic", labelKey: "emailEditor.toolbar.italic" },
  { key: "list", icon: List, command: "insertUnorderedList", labelKey: "emailEditor.toolbar.list" },
  { key: "link", icon: Link, command: "createLink", labelKey: "emailEditor.toolbar.link" },
];

export function EmailBodyEditor({ value, onChange, testID = "email-body-editor" }: EmailBodyEditorProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  // The caret position inside the surface, remembered while the user edits:
  // pressing a toolbar button or a placeholder chip blurs the surface, and a
  // bare focus() would put the caret at the very start — so every insert
  // restores the last known selection first (or falls back to the end).
  const savedRange = React.useRef<Range | null>(null);

  function rememberSelection() {
    const node = surfaceRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!node || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (node.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  }

  function restoreSelection() {
    const node = surfaceRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!node || !selection) return;
    node.focus();
    selection.removeAllRanges();
    if (savedRange.current) {
      selection.addRange(savedRange.current);
    } else {
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      selection.addRange(range);
    }
  }

  // Push external value changes (template switch) into the surface without
  // resetting the caret on every keystroke: only when the DOM differs.
  React.useEffect(() => {
    const node = surfaceRef.current;
    if (node && node.innerHTML !== value) node.innerHTML = value;
  }, [value]);

  function emit() {
    const node = surfaceRef.current;
    if (node) onChange(node.innerHTML);
  }

  function run(command: string) {
    restoreSelection();
    if (command === "createLink") {
      const url = typeof window !== "undefined" ? window.prompt(t("emailEditor.toolbar.linkPrompt"), "https://") : null;
      if (!url) return;
      document.execCommand("createLink", false, url);
    } else {
      document.execCommand(command, false);
    }
    emit();
  }

  function insert(text: string) {
    restoreSelection();
    document.execCommand("insertText", false, text);
    rememberSelection();
    emit();
  }

  return (
    <VStack space="sm">
      <HStack space="sm" className="flex-wrap items-center">
        <HStack space="xs" className="items-center rounded-lg border border-subtle p-0.5" testID="email-editor-toolbar">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Pressable
                key={tool.key}
                accessibilityRole="button"
                accessibilityLabel={t(tool.labelKey)}
                onPress={() => run(tool.command)}
                className={`${TAP_TARGET_ICON_BOX} rounded-md data-[hover=true]:bg-muted`}
                testID={`email-tool-${tool.key}`}
              >
                <Icon size={16} color={icons.foreground} />
              </Pressable>
            );
          })}
        </HStack>
        <Text size="xs" className="text-muted-foreground">{t("emailEditor.insertVariable")}</Text>
        <ChoicePillGroup>
          {TEMPLATE_VARIABLE_KEYS.map((key) => (
            <ChoicePill key={key} selected={false} onPress={() => insert(placeholder(key))} testID={`email-var-${key}`}>
              <Text size="xs">{t(`emailEditor.variables.${key}`)}</Text>
            </ChoicePill>
          ))}
        </ChoicePillGroup>
      </HStack>
      <div
        ref={surfaceRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={t("emailEditor.body")}
        data-testid={testID}
        onInput={() => {
          rememberSelection();
          emit();
        }}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onBlur={() => {
          rememberSelection();
          emit();
        }}
        className="min-h-[260px] rounded-lg border border-subtle bg-surface px-4 py-3 text-[15px] leading-6 text-foreground outline-none focus:border-primary [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2"
      />
    </VStack>
  );
}
