/** @jest-environment jsdom */
// components/invoices/composer/PartnerListOverlay.web.test.tsx
// Owner feedback 2026-11-06 (follow-up): react-native-web makes every View its
// own stacking context, so the open partner list drawn inside the composer
// tree sat BEHIND later sections ("Dátumok és fizetés", "Mit számlázol?").
// On web the list is portalled to document.body, fixed under the input.
import * as React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { PartnerListOverlay } from "@/components/invoices/composer/PartnerListOverlay.web";

function Harness({ open, onPress }: { open: boolean; onPress: () => void }) {
  const anchorRef = React.useRef<HTMLElement | null>(null);
  return (
    <section data-testid="composer-root">
      <div
        ref={(node) => {
          anchorRef.current = node;
          if (node) {
            node.getBoundingClientRect = () =>
              ({ left: 100, right: 500, top: 50, bottom: 92, width: 400, height: 42 }) as DOMRect;
          }
        }}
      />
      <PartnerListOverlay open={open} anchorRef={anchorRef} testID="composer-partner-results" id="composer-partner-results">
        <button data-testid="row" onClick={onPress}>
          Row
        </button>
      </PartnerListOverlay>
    </section>
  );
}

describe("PartnerListOverlay (web)", () => {
  it("renders nothing while closed", () => {
    const { queryByTestId } = render(<Harness open={false} onPress={jest.fn()} />);
    expect(queryByTestId("composer-partner-results")).toBeNull();
  });

  it("portals the list to document.body, outside the composer tree, under the input at its width", () => {
    const { getByTestId } = render(<Harness open onPress={jest.fn()} />);
    const list = getByTestId("composer-partner-results");
    expect(list.parentElement).toBe(document.body);
    expect(getByTestId("composer-root").contains(list)).toBe(false);
    expect(list.style.position).toBe("fixed");
    expect(list.style.top).toBe("96px");
    expect(list.style.left).toBe("100px");
    expect(list.style.width).toBe("400px");
    expect(Number(list.style.zIndex)).toBeGreaterThanOrEqual(1000);
  });

  it("keeps rows pressable and does not steal input focus on mousedown", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<Harness open onPress={onPress} />);
    const list = getByTestId("composer-partner-results");
    const notPrevented = fireEvent.mouseDown(list);
    expect(notPrevented).toBe(false); // default prevented -> input keeps focus, no blur-close
    fireEvent.click(getByTestId("row"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("repositions on scroll while open", () => {
    const { getByTestId } = render(<Harness open onPress={jest.fn()} />);
    const list = getByTestId("composer-partner-results");
    const anchor = document.querySelector("[data-testid=composer-root] div") as HTMLElement;
    anchor.getBoundingClientRect = () =>
      ({ left: 100, right: 500, top: 10, bottom: 52, width: 400, height: 42 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(list.style.top).toBe("56px");
  });
});
