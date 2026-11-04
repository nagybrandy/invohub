// components/ui/segmented-control/segmented-control.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { SegmentedControl, nextSegmentIndex } from "@/components/ui/segmented-control";

const OPTIONS = [
  { value: "invoice", label: "Számla" },
  { value: "proforma", label: "Díjbekérő" },
  { value: "advance", label: "Előlegszámla" },
] as const;

function render(props: Partial<React.ComponentProps<typeof SegmentedControl>> = {}) {
  const onChange = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <SegmentedControl options={OPTIONS} value="invoice" onChange={onChange} accessibilityLabel="Típus" {...props} />,
    );
  });
  const seg = (value: string) => tree.root.findByProps({ testID: `segmented-control-${value}` });
  return { tree, onChange, seg };
}

describe("nextSegmentIndex", () => {
  it("moves with arrows, wrapping around", () => {
    const none = [false, false, false];
    expect(nextSegmentIndex("ArrowRight", 0, none)).toBe(1);
    expect(nextSegmentIndex("ArrowDown", 2, none)).toBe(0);
    expect(nextSegmentIndex("ArrowLeft", 0, none)).toBe(2);
    expect(nextSegmentIndex("ArrowUp", 1, none)).toBe(0);
    expect(nextSegmentIndex("Home", 2, none)).toBe(0);
    expect(nextSegmentIndex("End", 0, none)).toBe(2);
  });

  it("skips disabled segments and ignores other keys", () => {
    expect(nextSegmentIndex("ArrowRight", 0, [false, true, false])).toBe(2);
    expect(nextSegmentIndex("ArrowLeft", 0, [false, true, false])).toBe(2);
    expect(nextSegmentIndex("Home", 1, [true, false, false])).toBe(1);
    expect(nextSegmentIndex("End", 0, [false, false, true])).toBe(1);
    expect(nextSegmentIndex("a", 0, [false])).toBeNull();
    expect(nextSegmentIndex("ArrowRight", 0, [])).toBeNull();
    expect(nextSegmentIndex("ArrowRight", 0, [true, true])).toBeNull();
  });
});

describe("SegmentedControl", () => {
  it("is a radiogroup of radios with aria-checked on the selected one", () => {
    const { tree, seg } = render();
    const group = tree.root.findByProps({ testID: "segmented-control" });
    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(group.props.accessibilityLabel).toBe("Típus");
    expect(seg("invoice").props.accessibilityRole).toBe("radio");
    expect(seg("invoice").props["aria-checked"]).toBe(true);
    expect(seg("proforma").props["aria-checked"]).toBe(false);
    expect(seg("proforma").props.accessibilityState).toMatchObject({ checked: false });
  });

  it("styles the active segment with the seg tokens", () => {
    const { seg } = render();
    expect(seg("invoice").props.className).toContain("bg-seg-active");
    expect(seg("proforma").props.className).not.toContain("bg-seg-active");
    expect(seg("proforma").props.className).toContain("data-[hover=true]:bg-seg-hover");
  });

  it("calls onChange when another segment is pressed, not for the selected one", () => {
    const { seg, onChange } = render();
    act(() => seg("advance").props.onPress());
    expect(onChange).toHaveBeenCalledWith("advance");
    act(() => seg("invoice").props.onPress());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("arrow keys move the selection and prevent the page from scrolling", () => {
    const { seg, onChange } = render({ value: "proforma" });
    const preventDefault = jest.fn();
    act(() => seg("proforma").props.onKeyDown({ key: "ArrowRight", preventDefault }));
    expect(onChange).toHaveBeenLastCalledWith("advance");
    expect(preventDefault).toHaveBeenCalled();
    act(() => seg("proforma").props.onKeyDown({ key: "ArrowLeft", preventDefault }));
    expect(onChange).toHaveBeenLastCalledWith("invoice");
    act(() => seg("proforma").props.onKeyDown({ nativeEvent: { key: "End" }, preventDefault }));
    expect(onChange).toHaveBeenLastCalledWith("advance");
  });

  it("ignores unrelated keys", () => {
    const { seg, onChange } = render();
    const preventDefault = jest.fn();
    act(() => seg("invoice").props.onKeyDown({ key: "a", preventDefault }));
    expect(onChange).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("a disabled segment is skipped by the keys and does not fire on press", () => {
    const { seg, onChange } = render({
      options: [OPTIONS[0], { ...OPTIONS[1], disabled: true }, OPTIONS[2]],
    });
    act(() => seg("invoice").props.onKeyDown({ key: "ArrowRight", preventDefault: jest.fn() }));
    expect(onChange).toHaveBeenLastCalledWith("advance");
    onChange.mockClear();
    act(() => seg("proforma").props.onPress?.());
    expect(onChange).not.toHaveBeenCalled();
    expect(seg("proforma").props.className).toContain("opacity-[0.45]");
  });

  it("size and width variants", () => {
    const sm = render({ size: "sm", fullWidth: true, outlined: true });
    const track = sm.tree.root.findByProps({ testID: "segmented-control" }).props.className;
    expect(track).toContain("rounded-[10px]");
    expect(track).not.toContain("max-w-[520px]");
    expect(track).toContain("border-seg-line");
    expect(sm.seg("invoice").props.className).toContain("min-h-[30px]");
    const md = render();
    expect(md.tree.root.findByProps({ testID: "segmented-control" }).props.className).toContain("max-w-[520px]");
    expect(md.seg("invoice").props.className).toContain("min-h-9");
  });
});
