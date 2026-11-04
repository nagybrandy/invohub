/** @jest-environment jsdom */
// components/ui/select/select.web.test.tsx
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({ muted: "#666" }) }));
jest.mock("lucide-react-native", () => ({ ChevronDown: () => null }));

import { Select } from "@/components/ui/select/index.web";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const OPTIONS = [
  { value: "huf", label: "HUF" },
  { value: "eur", label: "EUR" },
];

async function render(props: Partial<React.ComponentProps<typeof Select>> = {}) {
  const onChange = jest.fn();
  await act(async () => {
    root.render(<Select value="huf" onChange={onChange} options={OPTIONS} accessibilityLabel="Pénznem" {...props} />);
  });
  return { onChange, select: container.querySelector("select") as HTMLSelectElement };
}

describe("Select (web)", () => {
  it("is a labelled 42px native select with the options", async () => {
    const { select } = await render();
    expect(select.getAttribute("aria-label")).toBe("Pénznem");
    expect(select.style.height).toBe("42px");
    expect(select.value).toBe("huf");
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["HUF", "EUR"]);
    expect(select.className).toContain("border-line-strong");
    expect(select.className).toContain("rounded-control");
  });

  it("reports the chosen value", async () => {
    const { select, onChange } = await render();
    await act(async () => {
      select.value = "eur";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("eur");
  });

  it("shows a disabled placeholder option when there is no value", async () => {
    const { select } = await render({ value: "", placeholder: "Válassz" });
    expect(select.options[0].textContent).toBe("Válassz");
    expect(select.options[0].disabled).toBe(true);
    expect(select.className).toContain("text-faint");
  });

  it("invalid and disabled states", async () => {
    const { select } = await render({ invalid: true, disabled: true });
    expect(select.className).toContain("border-err");
    expect(select.disabled).toBe(true);
    expect(select.getAttribute("aria-invalid")).toBe("true");
  });
});
