// components/invoices/composer/PartnerPicker.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PartnerPicker } from "@/components/invoices/composer/PartnerPicker";
import type { Client } from "@/lib/clients/service";

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/input", () => {
  const ReactLib = require("react");
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: ReactLib.ReactNode }) => children ?? null,
    InputField: ReactLib.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      ReactLib.createElement(TextInput, { ref, ...props })
    ),
  };
});

const t = (key: string) => key;

function makeClients(count: number): Client[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `client-${i + 1}`,
    userId: "u1",
    name: `Partner ${i + 1} Kft.`,
    taxNumber: `1000000${i}-1-23`,
    createdAt: "",
    updatedAt: "",
  }));
}

function render(props: Partial<React.ComponentProps<typeof PartnerPicker>> = {}) {
  const onChangeText = props.onChangeText ?? jest.fn();
  const onSelect = props.onSelect ?? jest.fn();
  const onCreateNew = props.onCreateNew ?? jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <PartnerPicker
        clients={props.clients ?? []}
        recentClients={props.recentClients ?? []}
        value={props.value ?? ""}
        onChangeText={onChangeText}
        onSelect={onSelect}
        onCreateNew={onCreateNew}
        error={props.error}
        t={t}
      />
    );
  });
  return { tree: tree!, onChangeText, onSelect, onCreateNew };
}

function findByTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAll((node) => node.props?.testID === testID)[0];
}

describe("PartnerPicker (INV-18)", () => {
  it("finds a partner beyond the old 8-result cap by typing", () => {
    const clients = makeClients(12);
    const { tree } = render({ clients, value: "Partner 12" });

    const input = findByTestId(tree.root, "composer-partner-search");
    act(() => {
      input.props.onFocus?.();
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Partner 12 Kft.");
  });

  it("filters over the full client list, not just the first 8", () => {
    const clients = makeClients(12);
    const { tree, onSelect } = render({ clients, value: "100000011" }); // client-12's tax number

    const input = findByTestId(tree.root, "composer-partner-search");
    act(() => {
      input.props.onFocus?.();
    });

    const pressable = tree.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) => node.findAll((c) => c.props?.children === "Partner 12 Kft.").length > 0);
    expect(pressable).toBeTruthy();

    act(() => {
      pressable?.props.onPress?.();
    });
    expect(onSelect).toHaveBeenCalledWith(clients[11]);
  });

  it("shows an inline add-partner row instead of navigating away", () => {
    const { tree } = render({ clients: makeClients(2), value: "new co" });
    const input = findByTestId(tree.root, "composer-partner-search");
    act(() => {
      input.props.onFocus?.();
    });

    const addTrigger = tree.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) => node.findAll((c) => c.props?.children === "invoices.composer.addPartner").length > 0);
    expect(addTrigger).toBeTruthy();

    act(() => {
      addTrigger?.props.onPress?.();
    });

    expect(
      tree.root.findAll((node) => node.props?.placeholder === "invoices.composer.newPartnerName").length
    ).toBeGreaterThan(0);
  });

  it("submits name, email, taxNumber and the address fields together (Áfa tv. 169. § e)", async () => {
    const { tree, onCreateNew } = render({ clients: makeClients(1), value: "new co" });
    const input = findByTestId(tree.root, "composer-partner-search");
    act(() => {
      input.props.onFocus?.();
    });

    const addTrigger = tree.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) => node.findAll((c) => c.props?.children === "invoices.composer.addPartner").length > 0);
    act(() => {
      addTrigger?.props.onPress?.();
    });

    function setField(testID: string, text: string) {
      const field = findByTestId(tree.root, testID);
      act(() => {
        field.props.onChangeText?.(text);
      });
    }

    setField("composer-new-partner-zip", "1011");
    setField("composer-new-partner-city", "Budapest");
    setField("composer-new-partner-address", "Fő utca 1.");

    const confirm = tree.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) => node.findAll((c) => c.props?.children === "invoices.composer.addPartnerConfirm").length > 0);

    // The name field is required to submit — fill it via its placeholder.
    const nameField = tree.root.findAll((node) => node.props?.placeholder === "invoices.composer.newPartnerName")[0];
    act(() => {
      nameField.props.onChangeText?.("New Co Kft.");
    });

    await act(async () => {
      await confirm?.props.onPress?.();
    });

    expect(onCreateNew).toHaveBeenCalledWith({
      name: "New Co Kft.",
      email: "",
      taxNumber: "",
      zip: "1011",
      city: "Budapest",
      address: "Fő utca 1.",
    });
  });

  it("shows recent partners as chips when the field is empty and focused", () => {
    const clients = makeClients(4);
    const { tree } = render({ clients, recentClients: clients, value: "" });
    const input = findByTestId(tree.root, "composer-partner-search");
    act(() => {
      input.props.onFocus?.();
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.composer.recentPartners");
  });
});

describe("PartnerPicker — combobox semantics", () => {
  it("exposes the result list as a listbox of options", () => {
    const clients = makeClients(3);
    const { tree } = render({ clients, value: "Partner" });

    const input = findByTestId(tree.root, "composer-partner-search");
    act(() => {
      input.props.onFocus?.();
    });

    expect(input.props.role).toBe("combobox");
    expect(input.props["aria-expanded"]).toBe(true);

    const listbox = tree.root.findAll((n) => n.props?.role === "listbox");
    expect(listbox.length).toBeGreaterThan(0);

    const options = tree.root.findAll((n) => n.props?.role === "option");
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].props.accessibilityRole).toBe("button");
  });

  it("gives every result row a 44px tap target", () => {
    const clients = makeClients(3);
    const { tree } = render({ clients, value: "Partner" });

    const input = findByTestId(tree.root, "composer-partner-search");
    act(() => {
      input.props.onFocus?.();
    });

    const options = tree.root.findAll((n) => n.props?.role === "option");
    options.forEach((o) => expect(String(o.props.className)).toMatch(/min-h-11/));
  });

  it("marks the list collapsed when nothing is showing", () => {
    const { tree } = render({ clients: makeClients(3), value: "" });
    const input = findByTestId(tree.root, "composer-partner-search");

    expect(input.props["aria-expanded"]).toBe(false);
  });
});
