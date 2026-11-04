// components/ui/gluestack-ui-provider/script.test.ts
// The theme attribute rules: an explicit choice sets data-theme, "system"
// removes it, and the class always matches what is actually shown.
import { buildThemeBootScript, script, THEME_MIRROR_KEY } from "./script";

type FakeRoot = {
  attrs: Record<string, string>;
  classes: Set<string>;
  style: { colorScheme?: string };
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  classList: { add: (c: string) => void; remove: (c: string) => void };
};

function makeRoot(): FakeRoot {
  const root: FakeRoot = {
    attrs: {},
    classes: new Set(),
    style: {},
    setAttribute: (name, value) => {
      root.attrs[name] = value;
    },
    removeAttribute: (name) => {
      delete root.attrs[name];
    },
    classList: {
      add: (c) => root.classes.add(c),
      remove: (c) => root.classes.delete(c),
    },
  };
  return root;
}

const g = globalThis as unknown as { document?: unknown; window?: unknown };
const original = { document: g.document, window: g.window };

function install(systemDark: boolean, stored?: string) {
  const root = makeRoot();
  g.document = { documentElement: root };
  g.window = {
    matchMedia: () => ({ matches: systemDark }),
    localStorage: { getItem: (key: string) => (key === THEME_MIRROR_KEY ? (stored ?? null) : null) },
  };
  return root;
}

afterEach(() => {
  g.document = original.document;
  g.window = original.window;
});

describe("theme script", () => {
  it("light sets data-theme=light even under a dark OS", () => {
    const root = install(true);
    script("light");
    expect(root.attrs["data-theme"]).toBe("light");
    expect(root.classes.has("light")).toBe(true);
    expect(root.classes.has("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });

  it("dark sets data-theme=dark", () => {
    const root = install(false);
    script("dark");
    expect(root.attrs["data-theme"]).toBe("dark");
    expect(root.classes.has("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
  });

  it("system removes data-theme and lets the class follow the OS", () => {
    const root = install(true);
    root.attrs["data-theme"] = "light";
    script("system");
    expect(root.attrs["data-theme"]).toBeUndefined();
    expect(root.classes.has("dark")).toBe(true);
  });

  it("system under a light OS yields the light class", () => {
    const root = install(false);
    script("system");
    expect(root.attrs["data-theme"]).toBeUndefined();
    expect(root.classes.has("light")).toBe(true);
  });
});

describe("buildThemeBootScript", () => {
  function run(mode: string, stored?: string) {
    const root = install(false, stored);
    // eslint-disable-next-line no-new-func
    new Function(buildThemeBootScript(mode))();
    return root;
  }

  it("applies the mode when nothing is stored", () => {
    expect(run("dark").attrs["data-theme"]).toBe("dark");
  });

  it("lets the stored explicit choice win before first paint", () => {
    expect(run("light", "dark").attrs["data-theme"]).toBe("dark");
  });

  it("a stored 'system' removes the attribute", () => {
    const root = run("dark", "system");
    expect(root.attrs["data-theme"]).toBeUndefined();
  });

  it("ignores garbage in storage", () => {
    expect(run("light", "purple").attrs["data-theme"]).toBe("light");
  });
});
