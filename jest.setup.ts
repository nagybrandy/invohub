// jest.setup.ts
// Global Jest setup: mocks and test environment defaults.

const mockAsyncStorage = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.set(key, value);
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockAsyncStorage.get(key) ?? null)
  ),
  removeItem: jest.fn((key: string) => {
    mockAsyncStorage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockAsyncStorage.clear();
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve([...mockAsyncStorage.keys()])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

(globalThis as { __clearAsyncStorage?: () => void }).__clearAsyncStorage = () => {
  mockAsyncStorage.clear();
};

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native").View;
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn((c) => c),
    Directions: {},
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
});

if (typeof globalThis.window === "undefined") {
  (globalThis as { window: Window }).window = globalThis as unknown as Window;
}

if (typeof globalThis.window.dispatchEvent !== "function") {
  globalThis.window.dispatchEvent = () => true;
}
