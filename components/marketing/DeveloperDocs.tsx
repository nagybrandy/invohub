// components/marketing/DeveloperDocs.tsx
// Public developer documentation for the external /api/v1 API. The endpoint
// catalogue comes from lib/developers/api-reference.ts (kept in step with
// app/api/v1/** by its drift test); the prose comes from the `developers`
// i18n namespace. Code blocks scroll sideways instead of widening the page.
import * as React from "react";
import { Platform, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { landingType } from "@/components/marketing/landing-theme";
import { PublicPage } from "@/components/marketing/PublicPage";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  API_BASE_URL,
  API_ENDPOINTS,
  API_ENDPOINT_GROUPS,
  buildCurlSnippet,
  type ApiEndpoint,
  type Localized,
} from "@/lib/developers/api-reference";

type Lang = "hu" | "en";

const COLUMN = "mx-auto w-full max-w-[880px] min-w-0 px-4 py-10 tab:px-6 tab:py-14";
const focusRing =
  "web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary";
const H2 = "font-heading text-2xl font-bold leading-[1.2] text-ink";
const BODY = "text-base leading-[1.6] text-ink";

const GENERAL_SECTIONS = [
  "baseUrl",
  "auth",
  "errors",
  "rateLimits",
  "idempotency",
  "nav",
] as const;

/** Scroll to an in-page anchor. Web only: the public docs are a web page. */
function scrollToAnchor(id: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Renders `code` spans inside running text in a monospace face. */
export function RichText({ text, className = BODY }: { text: string; className?: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <Text className={className}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} className="font-mono text-[0.9em] text-ink">
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** Monospace block that scrolls horizontally on narrow screens. */
export function CodeBlock({ code, testID }: { code: string; testID?: string }) {
  return (
    <Box
      className="w-full min-w-0 max-w-full overflow-hidden rounded-control border border-line bg-wash2"
      testID={testID}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <Text selectable className="whitespace-pre p-3 font-mono text-xs leading-5 text-ink">
          {code}
        </Text>
      </ScrollView>
    </Box>
  );
}

function Badge({ label, tone }: { label: string; tone: "neutral" | "primary" }) {
  return (
    <Box
      className={`rounded-full px-2 py-0.5 ${tone === "primary" ? "bg-primary-wash" : "bg-wash2"}`}
    >
      <Text
        className={`text-[11px] font-semibold ${tone === "primary" ? "text-primary-ink" : "text-muted-ink"}`}
      >
        {label}
      </Text>
    </Box>
  );
}

function MethodBadge({ method }: { method: ApiEndpoint["method"] }) {
  return (
    <Box className="rounded-control bg-primary-wash px-2 py-0.5">
      <Text className="font-mono text-xs font-bold text-primary-ink">{method}</Text>
    </Box>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text className="pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
      {children}
    </Text>
  );
}

function EndpointCard({ endpoint, lang }: { endpoint: ApiEndpoint; lang: Lang }) {
  const { t } = useTranslation();
  const pick = (value: Localized) => value[lang];
  const locationLabel = (location: "path" | "query" | "body") => t(`developers.labels.${location}`);

  return (
    <Box
      id={endpoint.id}
      className="min-w-0 gap-3 rounded-card bg-surface p-4 shadow-card tab:p-5"
      testID={`developers-endpoint-${endpoint.id}`}
    >
      <VStack className="min-w-0 gap-2">
        <HStack className="flex-wrap items-center gap-2">
          <MethodBadge method={endpoint.method} />
          {endpoint.idempotent ? (
            <Badge label={t("developers.labels.idempotent")} tone="neutral" />
          ) : null}
        </HStack>
        <Text selectable className="font-mono text-sm font-semibold text-ink">
          {endpoint.path}
        </Text>
        <Heading size="md" className={landingType.cardTitle}>
          {pick(endpoint.summary)}
        </Heading>
        <RichText text={pick(endpoint.description)} className="text-sm leading-[22px] text-ink" />
      </VStack>

      {endpoint.params.length > 0 ? (
        <VStack className="gap-2">
          <SubHeading>{t("developers.labels.parameters")}</SubHeading>
          {endpoint.params.map((param) => (
            <VStack
              key={`${param.location}-${param.name}`}
              className="min-w-0 gap-1 border-t border-line pt-2"
            >
              <HStack className="flex-wrap items-center gap-2">
                <Text className="font-mono text-xs font-semibold text-ink">{param.name}</Text>
                <Text className="text-xs text-muted-ink">
                  {locationLabel(param.location)} · {param.type}
                </Text>
                <Badge
                  label={t(param.required ? "developers.labels.required" : "developers.labels.optional")}
                  tone={param.required ? "primary" : "neutral"}
                />
              </HStack>
              <RichText text={pick(param.description)} className="text-sm leading-[22px] text-muted-ink" />
            </VStack>
          ))}
        </VStack>
      ) : null}

      {endpoint.requestExample ? (
        <VStack className="gap-2">
          <SubHeading>{t("developers.labels.request")}</SubHeading>
          <CodeBlock code={endpoint.requestExample} testID={`developers-request-${endpoint.id}`} />
        </VStack>
      ) : null}

      <VStack className="gap-2">
        <SubHeading>{`${t("developers.labels.response")} · ${endpoint.responseStatus}`}</SubHeading>
        {endpoint.responseExample ? (
          <CodeBlock code={endpoint.responseExample} testID={`developers-response-${endpoint.id}`} />
        ) : (
          <Text className="text-sm text-muted-ink">
            {endpoint.responseContentType
              ? `${endpoint.responseContentType}. ${t("developers.labels.pdfBody")}`
              : t("developers.labels.noBody")}
          </Text>
        )}
      </VStack>

      <VStack className="gap-2">
        <SubHeading>{t("developers.labels.curl")}</SubHeading>
        <CodeBlock code={buildCurlSnippet(endpoint)} testID={`developers-curl-${endpoint.id}`} />
      </VStack>

      {endpoint.errors.length > 0 ? (
        <VStack className="gap-2">
          <SubHeading>{t("developers.labels.errors")}</SubHeading>
          {endpoint.errors.map((error, index) => (
            <HStack key={`${error.status}-${error.code ?? index}`} className="min-w-0 items-start gap-2">
              <Text className="font-mono text-xs font-semibold text-ink">{error.status}</Text>
              <VStack className="min-w-0 flex-1 gap-0.5">
                {error.code ? (
                  <Text className="font-mono text-xs text-muted-ink">{error.code}</Text>
                ) : null}
                <RichText text={pick(error.description)} className="text-sm leading-[22px] text-ink" />
              </VStack>
            </HStack>
          ))}
        </VStack>
      ) : null}
    </Box>
  );
}

const AUTH_BEARER = `Authorization: Bearer ih_pk_XXXXXXXX:ih_sk_XXXXXXXX
Content-Type: application/json`;
const AUTH_CUSTOM = `X-InvoHub-Public-Key: ih_pk_XXXXXXXX
X-InvoHub-Secret-Key: ih_sk_XXXXXXXX
Content-Type: application/json`;
const ERROR_SHAPE = `{ "error": "Invoice not found." }
{ "error": "Only a draft invoice can be updated.", "code": "notDraft" }`;
const RATE_LIMIT_SHAPE = `HTTP/1.1 429 Too Many Requests
Retry-After: 37

{ "error": "Rate limit exceeded. Try again later.", "code": "rateLimited" }`;
const IDEMPOTENCY_SHAPE = `Idempotency-Key: 6e6e6f76-0000-4000-8000-000000000001`;

const ERROR_ROWS = [
  ["400", "s400"],
  ["401", "s401"],
  ["404", "s404"],
  ["409", "s409"],
  ["422", "s422"],
  ["429", "s429"],
  ["500 / 502", "s5xx"],
] as const;

export function DeveloperDocsScreen() {
  const { t, i18n } = useTranslation();
  const lang: Lang = i18n.language?.startsWith("en") ? "en" : "hu";
  const sectionText = (section: string, key: string, vars?: Record<string, string>) =>
    t(`developers.sections.${section}.${key}`, vars);

  const tocItems = [
    ...GENERAL_SECTIONS.map((section) => ({
      id: `section-${section}`,
      label: sectionText(section, "title"),
    })),
    { id: "section-endpoints", label: sectionText("endpoints", "title") },
    ...API_ENDPOINT_GROUPS.map((group) => ({
      id: `group-${group.id}`,
      label: group.title[lang],
      nested: true,
    })),
  ];

  return (
    <PublicPage testID="developers-page">
      <VStack className={`${COLUMN} gap-10`}>
        <VStack className="gap-3">
          <Text className={landingType.eyebrow}>{t("developers.eyebrow")}</Text>
          <Heading className="font-heading text-[32px] phone:text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-ink">
            {t("developers.title")}
          </Heading>
          <Text className={landingType.lead}>{t("developers.lead")}</Text>
        </VStack>

        <VStack className="gap-2 rounded-card bg-surface p-4 shadow-card" testID="developers-toc">
          <SubHeading>{t("developers.toc")}</SubHeading>
          {tocItems.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="link"
              onPress={() => scrollToAnchor(item.id)}
              className={`min-h-9 justify-center rounded-control ${"nested" in item && item.nested ? "pl-4" : ""} ${focusRing}`}
              testID={`developers-toc-${item.id}`}
            >
              <Text className="text-sm font-medium text-primary">{item.label}</Text>
            </Pressable>
          ))}
        </VStack>

        <VStack id="section-baseUrl" className="gap-3">
          <Heading className={H2}>{sectionText("baseUrl", "title")}</Heading>
          <RichText text={sectionText("baseUrl", "body", { baseUrl: API_BASE_URL })} />
        </VStack>

        <VStack id="section-auth" className="gap-3">
          <Heading className={H2}>{sectionText("auth", "title")}</Heading>
          <RichText text={sectionText("auth", "body")} />
          <RichText text={sectionText("auth", "scope")} />
          <Text className="text-sm text-muted-ink">{sectionText("auth", "bearer")}</Text>
          <CodeBlock code={AUTH_BEARER} testID="developers-auth-bearer" />
          <Text className="text-sm text-muted-ink">{sectionText("auth", "custom")}</Text>
          <CodeBlock code={AUTH_CUSTOM} />
          <RichText text={sectionText("auth", "secret")} />
        </VStack>

        <VStack id="section-errors" className="gap-3">
          <Heading className={H2}>{sectionText("errors", "title")}</Heading>
          <RichText text={sectionText("errors", "body")} />
          <CodeBlock code={ERROR_SHAPE} />
          <VStack className="gap-2">
            {ERROR_ROWS.map(([status, key]) => (
              <HStack key={status} className="min-w-0 items-start gap-3 border-t border-line pt-2">
                <Text className="w-[72px] font-mono text-sm font-semibold text-ink">{status}</Text>
                <Box className="min-w-0 flex-1">
                  <RichText text={sectionText("errors", key)} className="text-sm leading-[22px] text-ink" />
                </Box>
              </HStack>
            ))}
          </VStack>
        </VStack>

        <VStack id="section-rateLimits" className="gap-3">
          <Heading className={H2}>{sectionText("rateLimits", "title")}</Heading>
          <RichText text={sectionText("rateLimits", "body")} />
          <CodeBlock code={RATE_LIMIT_SHAPE} testID="developers-rate-limit-example" />
        </VStack>

        <VStack id="section-idempotency" className="gap-3">
          <Heading className={H2}>{sectionText("idempotency", "title")}</Heading>
          <RichText text={sectionText("idempotency", "body")} />
          <CodeBlock code={IDEMPOTENCY_SHAPE} />
          <RichText text={sectionText("idempotency", "conflict")} />
          <RichText text={sectionText("idempotency", "which")} />
        </VStack>

        <VStack id="section-nav" className="gap-3">
          <Heading className={H2}>{sectionText("nav", "title")}</Heading>
          <RichText text={sectionText("nav", "body")} />
        </VStack>

        <VStack id="section-endpoints" className="gap-3">
          <Heading className={H2}>{sectionText("endpoints", "title")}</Heading>
          <RichText text={sectionText("endpoints", "body")} />
        </VStack>

        {API_ENDPOINT_GROUPS.map((group) => (
          <VStack key={group.id} id={`group-${group.id}`} className="min-w-0 gap-4">
            <Heading size="lg" className={landingType.cardTitle}>
              {group.title[lang]}
            </Heading>
            {API_ENDPOINTS.filter((endpoint) => endpoint.group === group.id).map((endpoint) => (
              <EndpointCard key={endpoint.id} endpoint={endpoint} lang={lang} />
            ))}
          </VStack>
        ))}
      </VStack>
    </PublicPage>
  );
}
