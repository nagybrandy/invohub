// lib/useHydrated.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { renderToString } from "react-dom/server";
import { useHydrated } from "@/lib/useHydrated";

function Probe() {
  return React.createElement("span", null, useHydrated() ? "client" : "server");
}

describe("useHydrated", () => {
  it("is false in a server render — the markup the client must match while hydrating", () => {
    expect(renderToString(React.createElement(Probe))).toContain("server");
  });

  it("is true once rendered on the client", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(React.createElement(Probe));
    });
    expect(JSON.stringify(tree.toJSON())).toContain("client");
  });
});
