// components/recurring/RecurringScheduleForm.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { RecurringScheduleForm } from "@/components/recurring/RecurringScheduleForm";
import type { RecurringFormValues } from "@/lib/recurring/form";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/form-control", () => {
  const { View, Text } = require("react-native");
  return {
    FormControl: View,
    FormControlLabel: View,
    FormControlLabelText: Text,
  };
});
jest.mock("@/components/ui/input", () => {
  const { View, TextInput } = require("react-native");
  return { Input: View, InputField: TextInput };
});
jest.mock("@/components/ui/segmented-control", () => {
  const { View, Pressable } = require("react-native");
  return {
    SegmentedControl: ({ options, onChange }: { options: { value: string; testID?: string }[]; onChange: (v: string) => void }) => (
      <View>
        {options.map((o) => (
          <Pressable key={o.value} testID={o.testID} onPress={() => onChange(o.value)} />
        ))}
      </View>
    ),
  };
});
jest.mock("@/components/invoices/composer/DateInput", () => {
  const { TextInput } = require("react-native");
  return { DateInput: (p: { testID?: string; value: string; onChangeText: (v: string) => void }) => <TextInput testID={p.testID} value={p.value} onChangeText={p.onChangeText} /> };
});

const initial: RecurringFormValues = {
  name: "",
  frequency: "monthly",
  startDate: "2027-01-31",
  endDate: "",
  maxOccurrences: "",
  paymentTermDays: "8",
};

function render(props: Partial<React.ComponentProps<typeof RecurringScheduleForm>> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <RecurringScheduleForm mode="create" initialValues={initial} onSubmit={onSubmit} onCancel={onCancel} {...props} />
    );
  });
  return { tree: tree!, onSubmit, onCancel };
}

const byId = (tree: TestRenderer.ReactTestRenderer, id: string) => tree.root.findByProps({ testID: id });

describe("RecurringScheduleForm", () => {
  it("submits the parsed schedule (frequency change, end date, count)", () => {
    const { tree, onSubmit } = render();
    act(() => byId(tree, "recurring-frequency-quarterly").props.onPress());
    act(() => byId(tree, "recurring-end-date").props.onChangeText("2028-01-31"));
    act(() => byId(tree, "recurring-max-occurrences").props.onChangeText("6"));
    act(() => byId(tree, "recurring-name").props.onChangeText(" Retainer "));
    act(() => byId(tree, "recurring-submit").props.onPress());
    expect(onSubmit).toHaveBeenCalledWith({
      ok: true,
      name: "Retainer",
      schedule: { frequency: "quarterly", startDate: "2027-01-31", endDate: "2028-01-31", maxOccurrences: 6 },
      paymentTermDays: 8,
    });
  });

  it("blocks an invalid schedule and shows the message instead of calling onSubmit", () => {
    const { tree, onSubmit } = render();
    act(() => byId(tree, "recurring-start-date").props.onChangeText("2027-02-30"));
    act(() => byId(tree, "recurring-submit").props.onPress());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(byId(tree, "recurring-form-error").props.children).toBe("recurring.form.invalidSchedule");
  });

  it("shows the payment term field only when editing, and the server error", () => {
    const create = render();
    expect(create.tree.root.findAllByProps({ testID: "recurring-payment-term" })).toHaveLength(0);
    const edit = render({ mode: "edit", error: "boom" });
    expect(byId(edit.tree, "recurring-payment-term")).toBeTruthy();
    expect(byId(edit.tree, "recurring-form-error").props.children).toBe("boom");
  });

  it("cancel calls onCancel", () => {
    const { tree, onCancel } = render();
    act(() => byId(tree, "recurring-cancel").props.onPress());
    expect(onCancel).toHaveBeenCalled();
  });
});
