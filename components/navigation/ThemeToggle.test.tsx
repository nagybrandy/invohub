// components/navigation/ThemeToggle.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";

const mockToggleTheme = jest.fn();
let mockIsDark = false;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({ isDarkColorScheme: mockIsDark, toggleTheme: mockToggleTheme }),
}));

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ThemeToggle tone="onLight" testID="tt" />);
  });
  return tree;
}

describe("ThemeToggle", () => {
  beforeEach(() => mockToggleTheme.mockClear());

  it("offers dark mode from light and flips on press", () => {
    mockIsDark = false;
    const tree = render();
    const btn = tree.root.findAll((n) => n.props.testID === "tt" && n.props.accessibilityLabel)[0];
    expect(btn.props.accessibilityLabel).toBe("nav.switchToDark");
    act(() => btn.props.onPress());
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("offers light mode from dark", () => {
    mockIsDark = true;
    const btn = render().root.findAll((n) => n.props.testID === "tt" && n.props.accessibilityLabel)[0];
    expect(btn.props.accessibilityLabel).toBe("nav.switchToLight");
  });
});
