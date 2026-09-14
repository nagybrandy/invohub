// components/settings/NavEnvironmentPicker.tsx
// Demo / test / production NAV mode selector. Production is always shown
// disabled — see docs/nav-test-setup.md for why it's a hard server-side gate,
// not just a UI hint.
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { NAV_ENVIRONMENTS, type NavEnvironment } from "@/lib/nav/environment";

export function NavEnvironmentPicker({
  value,
  onChange,
}: {
  value: NavEnvironment;
  onChange: (value: NavEnvironment) => void;
}) {
  const { t } = useTranslation();

  const labels: Record<NavEnvironment, string> = {
    demo: t("company.navMode.demo"),
    test: t("company.navMode.test"),
    production: t("company.navMode.production"),
  };

  return (
    <VStack space="xs">
      <HStack className="rounded-lg border border-border bg-muted p-1">
        {NAV_ENVIRONMENTS.map((environment) => {
          const disabled = environment === "production";
          return (
            <Pressable
              key={environment}
              disabled={disabled}
              onPress={() => {
                if (!disabled) onChange(environment);
              }}
              className={`flex-1 rounded-md px-3 py-2 ${
                value === environment ? "bg-background shadow-sm" : ""
              } ${disabled ? "opacity-40" : ""}`}
            >
              <Text
                size="sm"
                className={`text-center font-medium ${
                  value === environment ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {labels[environment]}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
      {value === "production" ? (
        <Text size="xs" className="text-muted-foreground">
          {t("company.navMode.productionDisabledHint")}
        </Text>
      ) : null}
    </VStack>
  );
}
