'use client';
import React from 'react';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import { buildThemeBootScript } from './script';

export type ModeType = 'light' | 'dark' | 'system';

// The theme variables live in global.css (generated from lib/theme/tokens.ts
// by lib/theme/theme-css.ts). This provider injects no palette of its own, so
// an older set of colours can never override the design tokens. After
// hydration lib/useColorScheme.tsx is the only writer of <html data-theme>;
// the inline script below only prevents a flash of the wrong theme on load.
export function GluestackUIProvider({
  mode = 'light',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
}) {
  return (
    <>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: buildThemeBootScript(mode),
        }}
      />
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </>
  );
}
