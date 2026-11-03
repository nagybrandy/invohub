// components/ui/input/index.tsx
// @ts-nocheck — Customized Gluestack input; cssInterop types lag behind NativeWind v4.
'use client';
import React from 'react';
import { createInput } from '@gluestack-ui/core/input/creator';
import { View, Pressable, TextInput } from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import { cssInterop } from 'nativewind';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { UIIcon } from '@gluestack-ui/core/icon/creator';

const SCOPE = 'INPUT';

const UIInput = createInput({
  Root: withStyleContext(View, SCOPE),
  Icon: UIIcon,
  Slot: Pressable,
  Input: TextInput,
});

cssInterop(UIIcon, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: true,
      width: true,
      fill: true,
      color: 'classNameColor',
      stroke: true,
    },
  },
});

// Redesign 2026-11 (tokens.md §6.3): inputs are 42px high with an 8px radius,
// a line-strong border on the surface colour; focus is a 2px primary outline
// hugging the border (offset 0) with the border turning primary; invalid is
// an err border; disabled is a wash2 field with faint text. The height is in
// the BASE string (tva/twMerge), so a call site that explicitly writes its own
// `h-*` still wins, which stays greppable in a diff.
export const INPUT_HEIGHT_PX = 42;
const inputStyleVariants = tva({
  base: `h-[42px] w-full flex-row items-center rounded-control border border-line-strong bg-surface transition-[color,border-color] overflow-hidden data-[focus=true]:border-primary data-[focus=true]:web:outline data-[focus=true]:web:outline-2 data-[focus=true]:web:outline-primary data-[invalid=true]:border-err data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:bg-wash2 px-3 gap-2`,
});
// tva()'s returned function destructures its argument directly, so calling
// it with zero arguments throws instead of resolving to the base string
// (see components/ui/button/index.tsx's buttonStyle for the same fix). This
// thin wrapper makes `inputStyle()` valid, for tap-target.test.ts and any
// other caller, while every real call site keeps passing `{ class }` as
// before.
export const inputStyle: typeof inputStyleVariants = (props) => inputStyleVariants(props ?? {});

const inputIconStyle = tva({
  base: 'justify-center items-center text-muted-ink fill-none h-4 w-4',
});

const inputSlotStyle = tva({
  base: 'justify-center items-center web:disabled:cursor-not-allowed',
});

const inputFieldStyle = tva({
  base: 'flex-1 text-ink font-normal text-sm md:text-sm py-1 h-full placeholder:text-faint web:data-[disabled=true]:text-faint  web:outline-none ios:leading-[0px] web:cursor-text web:data-[disabled=true]:cursor-not-allowed',
});

type IInputProps = React.ComponentProps<typeof UIInput> &
  VariantProps<typeof inputStyle> & { className?: string };
const Input = React.forwardRef<React.ComponentRef<typeof UIInput>, IInputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <UIInput
        ref={ref}
        {...props}
        className={inputStyle({ class: className })}
        context={{}}
      />
    );
  }
);

type IInputIconProps = React.ComponentProps<typeof UIInput.Icon> &
  VariantProps<typeof inputIconStyle> & {
    className?: string;
    height?: number;
    width?: number;
  };

const InputIcon = React.forwardRef<
  React.ComponentRef<typeof UIInput.Icon>,
  IInputIconProps
>(function InputIcon({ className, ...props }, ref) {
  return (
    <UIInput.Icon
      ref={ref}
      {...props}
      className={inputIconStyle({ class: className })}
    />
  );
});

type IInputSlotProps = React.ComponentProps<typeof UIInput.Slot> &
  VariantProps<typeof inputSlotStyle> & { className?: string };

const InputSlot = React.forwardRef<
  React.ComponentRef<typeof UIInput.Slot>,
  IInputSlotProps
>(function InputSlot({ className, ...props }, ref) {
  return (
    <UIInput.Slot
      ref={ref}
      {...props}
      className={inputSlotStyle({
        class: className,
      })}
    />
  );
});

type IInputFieldProps = React.ComponentProps<typeof UIInput.Input> &
  VariantProps<typeof inputFieldStyle> & { className?: string };

const InputField = React.forwardRef<
  React.ComponentRef<typeof UIInput.Input>,
  IInputFieldProps
>(function InputField({ className, ...props }, ref) {
  return (
    <UIInput.Input
      ref={ref}
      {...props}
      aria-label={props.accessibilityLabel}
      className={inputFieldStyle({
        class: className,
      })}
    />
  );
});

Input.displayName = 'Input';
InputIcon.displayName = 'InputIcon';
InputSlot.displayName = 'InputSlot';
InputField.displayName = 'InputField';

export { Input, InputField, InputIcon, InputSlot };
