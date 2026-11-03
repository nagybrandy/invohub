// components/navigation/GlobalSearchField.tsx
// The global search input (SPEC §5.2, tokens.md §6.11): "Keresés", a search
// icon, no keyboard-hint badge. Desktop: a 36px field (340px) in the top bar.
// Phone: the same field full width with a close button once the header's
// search icon expanded it. It owns the query and renders the results below
// through `components/search/GlobalSearchResults` (the home track fills that
// in); Esc clears the field, closes the results and gives focus back.
import * as React from "react";
import { TextInput } from "react-native";
import { Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { GlobalSearchResults } from "@/components/search/GlobalSearchResults";
import { useIconColors } from "@/lib/theme/icon-colors";

export type GlobalSearchFieldProps = {
  variant: "desktop" | "phone";
  /** Phone: called by the close button and by Esc. */
  onClose?: () => void;
  autoFocus?: boolean;
  testID?: string;
};

type KeyEvent = { nativeEvent?: { key?: string }; key?: string };

export function GlobalSearchField({
  variant,
  onClose,
  autoFocus = false,
  testID = "global-search",
}: GlobalSearchFieldProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<TextInput | null>(null);
  const phone = variant === "phone";

  const reset = React.useCallback(() => {
    setQuery("");
    inputRef.current?.blur?.();
    onClose?.();
  }, [onClose]);

  return (
    <Box
      testID={`${testID}-root`}
      className={phone ? "relative min-w-0 flex-1" : "relative w-[340px] min-w-[190px] shrink"}
    >
      <Box
        // The ring sits on the field box (the DOM input inside has no outline).
        className={`flex-row items-center gap-2 rounded-control border border-line-strong bg-surface pl-2.5 pr-2 web:focus-within:border-primary web:focus-within:outline web:focus-within:outline-2 web:focus-within:outline-primary ${
          phone ? "h-10" : "h-9"
        }`}
      >
        <Search size={16} color={icons.muted} />
        <TextInput
          ref={inputRef}
          testID={testID}
          value={query}
          onChangeText={setQuery}
          autoFocus={autoFocus}
          placeholder={t("shell.search.placeholder")}
          accessibilityLabel={t("shell.search.label")}
          role="searchbox"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          onKeyPress={(event: KeyEvent) => {
            if ((event.nativeEvent?.key ?? event.key) === "Escape") reset();
          }}
          className="min-w-0 flex-1 py-0 text-sm text-ink placeholder:text-faint web:outline-none"
        />
        {phone ? (
          <Pressable
            testID={`${testID}-close`}
            accessibilityRole="button"
            accessibilityLabel={t("shell.search.close")}
            onPress={reset}
            className="h-8 w-8 items-center justify-center rounded-full data-[hover=true]:bg-neutral-wash"
          >
            <X size={16} color={icons.muted} />
          </Pressable>
        ) : null}
      </Box>
      <GlobalSearchResults query={query} onClose={reset} variant={phone ? "panel" : "popover"} />
    </Box>
  );
}
