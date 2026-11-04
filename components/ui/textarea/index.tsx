// components/ui/textarea/index.tsx
// Customized Gluestack textarea with light copy, 8px radius, and border200.
'use client';
import React from 'react';
import { createTextarea } from '@gluestack-ui/core/textarea/creator';
import { View, TextInput } from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import {
  withStyleContext,
  useStyleContext,
} from '@gluestack-ui/utils/nativewind-utils';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

const SCOPE = 'TEXTAREA';
const UITextarea = createTextarea({
  Root: withStyleContext(View, SCOPE),
  Input: TextInput,
});

// Redesign 2026-11 (tokens.md §6.3): min-height 90px, 8px radius, line-strong
// border on the surface colour; focus = primary border + 2px outline.
const textareaStyle = tva({
  base: 'focus-ring-host w-full min-h-[90px] border border-line-strong bg-surface rounded-control data-[focus=true]:border-primary data-[focus=true]:web:outline data-[focus=true]:web:outline-2 data-[focus=true]:web:outline-primary data-[invalid=true]:border-err data-[disabled=true]:bg-wash2',

  variants: {
    variant: {
      default: '',
    },
    size: {
      sm: '',
      md: '',
      lg: '',
      xl: '',
    },
  },
});

const textareaInputStyle = tva({
  base: 'px-3 py-2.5 web:outline-0 web:outline-none flex-1 text-ink font-normal placeholder:text-faint web:cursor-text web:data-[disabled=true]:cursor-not-allowed web:data-[disabled=true]:text-faint',
  parentVariants: {
    size: {
      sm: 'text-sm',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg',
    },
  },
});

type ITextareaProps = React.ComponentProps<typeof UITextarea> &
  VariantProps<typeof textareaStyle>;

const Textarea = React.forwardRef<
  React.ComponentRef<typeof UITextarea>,
  ITextareaProps
>(function Textarea(
  { className, variant = 'default', size = 'md', ...props },
  ref
) {
  return (
    <UITextarea
      ref={ref}
      {...props}
      className={textareaStyle({ variant, class: className })}
      context={{ size }}
    />
  );
});

type ITextareaInputProps = React.ComponentProps<typeof UITextarea.Input> &
  VariantProps<typeof textareaInputStyle>;

const TextareaInput = React.forwardRef<
  React.ComponentRef<typeof UITextarea.Input>,
  ITextareaInputProps
>(function TextareaInput({ className, ...props }, ref) {
  const { size: parentSize } = useStyleContext(SCOPE);

  return (
    <UITextarea.Input
      ref={ref}
      {...props}
      textAlignVertical="top"
      className={textareaInputStyle({
        parentVariants: {
          size: parentSize,
        },
        class: className,
      })}
    />
  );
});

Textarea.displayName = 'Textarea';
TextareaInput.displayName = 'TextareaInput';

export { Textarea, TextareaInput };
