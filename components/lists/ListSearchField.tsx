// components/lists/ListSearchField.tsx
// The list toolbar's search field (tokens.md §6.3): 40px, search icon in the
// faint colour at the left, placeholder in faint. Controlled; the caller
// debounces.
import { Search } from "lucide-react-native";
import { Input, InputField } from "@/components/ui/input";
import { useIconColors } from "@/lib/theme/icon-colors";

export function ListSearchField({
  value,
  onChangeText,
  placeholder,
  testID,
  accessibilityLabel,
  className = "",
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  testID?: string;
  accessibilityLabel?: string;
  /** Extra layout classes (`min-w-0 flex-1` inside a toolbar row). */
  className?: string;
}) {
  const icons = useIconColors();
  return (
    <Input className={`h-10 w-full ${className}`}>
      <Search size={16} color={icons.faint} />
      <InputField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        returnKeyType="search"
        testID={testID}
      />
    </Input>
  );
}
