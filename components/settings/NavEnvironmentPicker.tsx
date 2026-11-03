// components/settings/NavEnvironmentPicker.tsx
// Demo / test / production NAV mode selector. Production is selectable only
// when the server says so (GET /api/nav/config → productionEnabled, i.e.
// NAV_PRODUCTION_ENABLED=true): the kill switch lives on the server
// (lib/nav/environment.ts), the picker just mirrors it — a stored
// "production" still falls back to demo there when the switch is off.
// Look: the segmented control (tokens.md §6.1).
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
      <HStack accessibilityRole="radiogroup" className="gap-1 rounded-xl border border-seg-line bg-seg-track p-1">
        {NAV_ENVIRONMENTS.map((environment) => {
          const disabled = environment === "production" && !productionEnabled;
          const selected = value === environment;
          return (
            <Pressable
              key={environment}
              testID={`nav-environment-${environment}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              aria-checked={selected}
              disabled={disabled}
              onPress={() => {
                if (!disabled) onChange(environment);
              }}
              className={`min-h-9 min-w-0 flex-1 items-center justify-center rounded-control px-3 py-2 ${
                selected ? "bg-seg-active" : "data-[hover=true]:bg-seg-hover"
              } ${disabled ? "opacity-40" : ""}`}
            >
              <Text
                size="sm"
                className={`text-center ${selected ? "font-medium text-seg-active-ink" : "font-normal text-seg-ink"}`}
              >
                {labels[environment]}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
      {value === "production" ? (
        <Text size="xs" className="text-muted-ink" testID="nav-production-hint">
          {t(productionEnabled ? "company.navMode.productionEnabledHint" : "company.navMode.productionDisabledHint")}
        </Text>
      ) : null}
    </VStack>
  );
}
