// components/settings/NavEnvironmentPicker.tsx
// Demo / test / production NAV mode selector. Production is selectable only
// when the server says so (GET /api/nav/config → productionEnabled, i.e.
// NAV_PRODUCTION_ENABLED=true): the kill switch lives on the server
// (lib/nav/environment.ts), the picker just mirrors it — a stored
// "production" still falls back to demo there when the switch is off.
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { NAV_ENVIRONMENTS, type NavEnvironment } from "@/lib/nav/environment";

export function NavEnvironmentPicker({
  value,
  onChange,
  productionEnabled = false,
}: {
  value: NavEnvironment;
  onChange: (value: NavEnvironment) => void;
  /** The server's answer; until it arrives production stays disabled. */
  productionEnabled?: boolean;
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
          const disabled = environment === "production" && !productionEnabled;
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
        <Text size="xs" className="text-muted-foreground" testID="nav-production-hint">
          {t(productionEnabled ? "company.navMode.productionEnabledHint" : "company.navMode.productionDisabledHint")}
        </Text>
      ) : null}
    </VStack>
  );
}
