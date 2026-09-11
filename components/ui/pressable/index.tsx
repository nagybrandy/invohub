// components/ui/pressable/index.tsx
// Shared interactive primitive with accessible, reduced-motion-safe web feedback.
'use client';
import React from 'react';
import { createPressable } from '@gluestack-ui/core/pressable/creator';
import { Pressable as RNPressable } from 'react-native';

import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

const UIPressable = createPressable({
  Root: withStyleContext(RNPressable),
});

const pressableStyle = tva({
  base: 'web:transition-[color,background-color,border-color,opacity,box-shadow] web:duration-200 motion-reduce:web:transition-none data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-primary/50 data-[focus-visible=true]:ring-2 data-[disabled=true]:opacity-40',
});

type IPressableProps = Omit<
  React.ComponentProps<typeof UIPressable>,
  'context'
> &
  VariantProps<typeof pressableStyle>;
const Pressable = React.forwardRef<
  React.ComponentRef<typeof UIPressable>,
  IPressableProps
>(function Pressable({ className, ...props }, ref) {
  return (
    <UIPressable
      {...props}
      ref={ref}
      className={pressableStyle({
        class: className,
      })}
    />
  );
});

Pressable.displayName = 'Pressable';
export { Pressable };
