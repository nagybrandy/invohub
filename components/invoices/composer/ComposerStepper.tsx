// components/invoices/composer/ComposerStepper.tsx
// Three clickable steps — no forced wizard (spec §2.2): the user can jump
// to any step at any time, a red dot marks a step with a blocking error.
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { COMPOSER_STEP_ORDER, type ComposerStepId } from "@/components/invoices/composer/composer-logic";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

const STEP_LABEL_KEYS: Record<ComposerStepId, string> = {
  partner: "invoices.composer.steps.partner",
  items: "invoices.composer.steps.items",
  review: "invoices.composer.steps.review",
};

export function ComposerStepper({
  current,
  invalidSteps,
  onSelect,
  t,
}: {
  current: ComposerStepId;
  invalidSteps: Record<ComposerStepId, boolean>;
  onSelect: (step: ComposerStepId) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <HStack space="md" className="items-center flex-wrap">
      {COMPOSER_STEP_ORDER.map((stepId, index) => {
        const isCurrent = stepId === current;
        const isInvalid = invalidSteps[stepId];
        return (
          <Pressable
            testID={`composer-stepper-${stepId}`}
            key={stepId}
            onPress={() => onSelect(stepId)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isCurrent }}
            className={`flex-row items-center ${TAP_TARGET_MIN_H}`}
          >
            <HStack space="xs" className="items-center">
              <VStack
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  isCurrent
                    ? "bg-primary"
                    : isInvalid
                      ? "bg-destructive/10 border border-destructive"
                      : "bg-muted"
                }`}
              >
                <Text
                  size="xs"
                  className={`font-semibold ${
                    isCurrent ? "text-primary-foreground" : isInvalid ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </Text>
              </VStack>
              <Text
                size="sm"
                className={
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isInvalid
                      ? "font-medium text-destructive"
                      : "font-light text-muted-foreground"
                }
              >
                {t(STEP_LABEL_KEYS[stepId])}
              </Text>
              {isInvalid ? <VStack className="h-1.5 w-1.5 rounded-full bg-destructive" /> : null}
            </HStack>
            {index < COMPOSER_STEP_ORDER.length - 1 ? (
              <Text className="mx-2 text-muted-foreground" accessibilityElementsHidden>
                ─
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </HStack>
  );
}
