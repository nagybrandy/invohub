// components/settings/NavEnvironmentPicker.tsx
// Test vs live NAV environment selector.
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  NAV_ENVIRONMENT_LABELS,
  NAV_ENVIRONMENTS,
  type NavEnvironment,
} from "@/lib/nav/environment";

export function NavEnvironmentPicker({
  value,
  onChange,
}: {
  value: NavEnvironment;
  onChange: (value: NavEnvironment) => void;
}) {
  return (
    <HStack className="rounded-lg border border-border bg-muted p-1">
      {NAV_ENVIRONMENTS.map((environment) => (
        <Pressable
          key={environment}
          onPress={() => onChange(environment)}
          className={`flex-1 rounded-md px-3 py-2 ${
            value === environment ? "bg-background shadow-sm" : ""
          }`}
        >
          <Text
            size="sm"
            className={`text-center font-medium ${
              value === environment ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {NAV_ENVIRONMENT_LABELS[environment]}
          </Text>
        </Pressable>
      ))}
    </HStack>
  );
}
