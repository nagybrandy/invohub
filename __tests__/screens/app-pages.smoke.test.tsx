// __tests__/screens/app-pages.smoke.test.tsx
// Smoke tests: every app screen renders without throwing.
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ id: "inv-test-1" })),
  useGlobalSearchParams: jest.fn(() => ({ id: "inv-test-1" })),
  usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([]),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

jest.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", name: "Test", email: "test@example.com", role: "admin" } },
  }),
  signOut: jest.fn(),
}));

jest.mock("@/lib/api/client", () => {
  const { makeInvoice } = require("@/__tests__/fixtures/invoices");
  const defaultInvoice = makeInvoice({ id: "inv-test-1" });

  const mockApiFetch = jest.fn(async (path: string) => {
    if (path.includes("/api/reminders")) {
      return {
        schedules: [
          {
            id: "sched-1",
            intervalDays: 7,
            maxReminders: 3,
            enabled: true,
          },
        ],
      };
    }
    if (path.includes("/api/admin")) {
      return {
        users: [{ id: "user-1", name: "Test", email: "test@example.com", role: "admin" }],
        stats: { users: 1, invoices: 1 },
      };
    }
    if (path.includes("/api/invoices")) {
      return { invoice: defaultInvoice, invoices: [defaultInvoice], total: 1 };
    }
    if (path.includes("/api/clients")) {
      return {
        clients: [
          {
            id: "cl-1",
            name: "Acme",
            email: "client@test.com",
            createdAt: "",
            updatedAt: "",
          },
        ],
      };
    }
    if (path.includes("/api/products")) {
      return {
        products: [
          {
            id: "prod-1",
            name: "Service",
            unitPrice: 100,
            vatRate: 27,
            createdAt: "",
            updatedAt: "",
          },
        ],
      };
    }
    if (path.includes("/api/receipts")) {
      return { receipts: [], receipt: null };
    }
    return { invoice: defaultInvoice, users: [], stats: { users: 1, invoices: 1 } };
  });

  return {
    apiFetch: mockApiFetch,
    apiFetchBlob: jest.fn().mockResolvedValue(new Blob()),
    invoicePdfUrl: (id: string) => `/api/invoices/${id}/pdf`,
  };
});

jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({ isDarkColorScheme: false, toggleTheme: jest.fn() }),
}));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    foreground: "#000",
    muted: "#666",
    primary: "#4f46e5",
    accentForeground: "#fff",
  }),
}));

jest.mock("@/hooks/useInvoices", () => {
  const { makeInvoice } = require("@/__tests__/fixtures/invoices");
  return {
    useInvoices: () => ({
      invoices: [makeInvoice()],
      total: 1,
      loading: false,
      error: null,
      stats: { count: 1, thisMonthCount: 1, monthlyTotal: 1000 },
      refresh: jest.fn(),
      addOrUpdate: jest.fn(),
      remove: jest.fn(),
    }),
  };
});

jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({
    company: { id: "c1", name: "Demo Kft.", taxNumber: "12345678-1-23" },
    loading: false,
    save: jest.fn(),
    lookup: jest.fn(),
  }),
}));

const mockPdfTemplate = {
  titleText: "INVOICE",
  accentColor: "#4f46e5",
  showCompanyBlock: true,
  showBankDetails: true,
  showClientTaxNumber: true,
  footerText: "Thanks",
  notesLabel: "Notes",
  fontScale: "medium" as const,
};

jest.mock("@/hooks/usePdfTemplate", () => ({
  usePdfTemplate: () => ({
    template: mockPdfTemplate,
    loading: false,
    save: jest.fn(),
    previewSample: jest.fn(),
  }),
}));

const mockEmailTemplate = {
  id: "t1",
  type: "invoice_notification" as const,
  subject: "Invoice",
  bodyHtml: "<p>Hi</p>",
};

jest.mock("@/hooks/useEmailTemplates", () => ({
  useEmailTemplates: () => ({
    templates: [mockEmailTemplate],
    loading: false,
    update: jest.fn(),
  }),
}));

jest.mock("@/hooks/useApiKeys", () => ({
  useApiKeys: () => ({
    keys: [],
    loading: false,
    error: null,
    create: jest.fn(),
    revoke: jest.fn(),
  }),
}));

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  }),
}));

jest.mock("@/components/invoices/InvoicePreviewModal", () => ({
  InvoicePreviewModal: () => null,
}));

jest.mock("@/components/ui/drawer", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return {
    Drawer: mockUi.View,
    DrawerBackdrop: mockUi.View,
    DrawerContent: mockUi.View,
    DrawerHeader: mockUi.View,
    DrawerBody: mockUi.View,
    DrawerFooter: mockUi.View,
    DrawerCloseButton: mockUi.Pressable,
  };
});

jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ children }: { children?: unknown }) => children ?? null,
}));

jest.mock("@/components/layout/FormScreen", () => ({
  FormScreen: ({ children }: { children?: unknown }) => children ?? null,
}));

jest.mock("@/components/invoices/InvoiceDocumentPreview", () => ({
  InvoiceDocumentPreview: () => null,
}));

jest.mock("@/lib/useIsDesktop", () => ({
  useIsDesktop: () => false,
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/badge", () => mockUi);
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Pressable,
  ButtonText: mockUi.Text,
  ButtonSpinner: mockUi.View,
}));
jest.mock("@/components/ui/input", () => ({ Input: mockUi.View, InputField: mockUi.Text }));
jest.mock("@/components/ui/textarea", () => ({ Textarea: mockUi.View, TextareaInput: mockUi.Text }));
jest.mock("@/components/ui/form-control", () => ({
  FormControl: mockUi.View,
  FormControlLabel: mockUi.View,
  FormControlLabelText: mockUi.Text,
}));
jest.mock("@/components/ui/heading", () => ({ Heading: mockUi.Text }));
jest.mock("@/components/ui/spinner", () => ({ Spinner: mockUi.View }));
jest.mock("@/components/ui/divider", () => ({ Divider: mockUi.View }));

const SCREENS: Array<{ label: string; loader: () => { default: React.ComponentType } }> = [
  { label: "dashboard", loader: () => require("@/app/(app)/dashboard/index") },
  { label: "invoices list", loader: () => require("@/app/(app)/invoices/index") },
  { label: "new invoice", loader: () => require("@/app/(app)/invoices/new") },
  { label: "invoice detail", loader: () => require("@/app/(app)/invoices/[id]/index") },
  { label: "invoice edit", loader: () => require("@/app/(app)/invoices/[id]/edit") },
  { label: "clients list", loader: () => require("@/app/(app)/clients/index") },
  { label: "new client", loader: () => require("@/app/(app)/clients/new") },
  { label: "client edit", loader: () => require("@/app/(app)/clients/[id]/edit") },
  { label: "products list", loader: () => require("@/app/(app)/products/index") },
  { label: "product edit", loader: () => require("@/app/(app)/products/[id]/edit") },
  { label: "receipts list", loader: () => require("@/app/(app)/receipts/index") },
  { label: "new receipt", loader: () => require("@/app/(app)/receipts/new") },
  { label: "receipt detail", loader: () => require("@/app/(app)/receipts/[id]/index") },
  { label: "import", loader: () => require("@/app/(app)/import/index") },
  { label: "settings", loader: () => require("@/app/(app)/settings/index") },
  { label: "settings company", loader: () => require("@/app/(app)/settings/company") },
  { label: "settings templates", loader: () => require("@/app/(app)/settings/templates") },
  { label: "settings reminders", loader: () => require("@/app/(app)/settings/reminders") },
  { label: "settings api keys", loader: () => require("@/app/(app)/settings/api-keys") },
  { label: "settings pdf", loader: () => require("@/app/(app)/settings/pdf") },
  { label: "admin", loader: () => require("@/app/(app)/admin/index") },
];

function renderScreen(Screen: React.ComponentType) {
  act(() => {
    TestRenderer.create(<Screen />);
  });
}

describe("app screens smoke", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: jest.fn() } },
      configurable: true,
    });
  });

  it.each(SCREENS)("$label renders", ({ loader }) => {
    const Screen = loader().default;
    expect(() => renderScreen(Screen)).not.toThrow();
  });
});
