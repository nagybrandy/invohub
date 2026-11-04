// app/(app)/email-editor/index.tsx
// The visual e-mail editor became Settings > E-mailek szövege (it needs the
// settings frame and nav); the old menu item and any bookmark land there.
import { Redirect } from "expo-router";
import { routes } from "@/lib/navigation";

export default function EmailEditorRedirect() {
  return <Redirect href={routes.settingsTemplates} />;
}
