// components/ui/button/index.tsx
// @ts-nocheck — Customized Gluestack button; cssInterop types lag behind NativeWind v4.
'use client';
import React from 'react';
import { createButton } from '@gluestack-ui/core/button/creator';
import {
  tva,
  withStyleContext,
  useStyleContext,
  type VariantProps,
} from '@gluestack-ui/utils/nativewind-utils';
import { cssInterop } from 'nativewind';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { UIIcon } from '@gluestack-ui/core/icon/creator';
const SCOPE = 'BUTTON';
const Root = withStyleContext(Pressable, SCOPE);
const UIButton = createButton({
  Root: Root,
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: UIIcon,
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

// Redesign 2026-11 (tokens.md §6.2): one Button, five variants, five sizes.
// Heights are the design's (sm 34, md 40, form 42, lg 46); the old 44px
// floor lived here before and now only applies to ChoicePill and the 44px
// icon boxes. On phones `sm` grows to 40 so touch targets stay >= 40px.
//
// Variants: primary | secondary | tertiary | danger | dangerSolid.
// Old names keep working through VARIANT_ALIAS: default -> primary,
// outline -> secondary, link/ghost -> tertiary, destructive -> dangerSolid.
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'dangerSolid';
export type ButtonVariantInput =
  | ButtonVariant
  | 'default'
  | 'outline'
  | 'link'
  | 'ghost'
  | 'destructive';

export const VARIANT_ALIAS: Record<ButtonVariantInput, ButtonVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  danger: 'danger',
  dangerSolid: 'dangerSolid',
  default: 'primary',
  outline: 'secondary',
  link: 'tertiary',
  ghost: 'tertiary',
  destructive: 'dangerSolid',
};

export function resolveButtonVariant(variant?: ButtonVariantInput): ButtonVariant {
  return VARIANT_ALIAS[variant ?? 'primary'] ?? 'primary';
}

const buttonStyleVariants = tva({
  base: 'rounded-control flex-row items-center justify-center gap-2 web:transition-[color,background-color,border-color,opacity,box-shadow] web:duration-150 motion-reduce:web:transition-none data-[disabled=true]:opacity-40',
  variants: {
    variant: {
      primary: 'bg-primary data-[hover=true]:bg-primary-press data-[active=true]:bg-primary-press',
      secondary:
        'border border-line-strong bg-surface data-[hover=true]:bg-neutral-wash data-[active=true]:bg-neutral-wash',
      tertiary: 'bg-transparent data-[hover=true]:bg-neutral-wash data-[active=true]:bg-neutral-wash',
      danger:
        'border border-err-line bg-surface data-[hover=true]:bg-err-wash data-[active=true]:bg-err-wash',
      dangerSolid: 'bg-err data-[hover=true]:opacity-90 data-[active=true]:opacity-90',
    },
    size: {
      default: 'h-10 px-4',
      md: 'h-10 px-4',
      sm: 'h-[34px] phone:h-10 px-3',
      form: 'h-[42px] px-4',
      lg: 'h-[46px] px-[22px]',
      icon: 'h-[34px] w-[34px] phone:h-10 phone:w-10 px-0',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
  },
});
// tva()'s returned function destructures its argument directly, so calling
// it with zero arguments throws instead of resolving to the `primary`/
// `default` path. This thin wrapper makes `buttonStyle()` a valid way to ask
// "what does a bare Button render as", and maps the old variant names.
const buttonStyle = (props) =>
  buttonStyleVariants({
    ...(props ?? {}),
    variant: resolveButtonVariant(props?.variant),
  });
const buttonTextStyle = tva({
  base: 'web:select-none font-sans font-semibold',
  parentVariants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-ink',
      tertiary: 'text-primary',
      danger: 'text-err',
      dangerSolid: 'text-white',
    },
    size: {
      default: 'text-sm',
      md: 'text-sm',
      sm: 'text-[13px]',
      form: 'text-sm',
      lg: 'text-[15px]',
      icon: 'text-sm',
    },
  },
});

const buttonSpinnerStyle = tva({
  base: '',
  parentVariants: {
    size: {
      default: 'h-4 w-4',
      md: 'h-4 w-4',
      sm: 'h-4 w-4',
      form: 'h-4 w-4',
      lg: 'h-4 w-4',
      icon: 'h-4 w-4',
    },
  },
});

const buttonIconStyle = tva({
  base: 'fill-none pointer-events-none shrink-0',
  parentVariants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-ink',
      tertiary: 'text-primary',
      danger: 'text-err',
      dangerSolid: 'text-white',
    },
    size: {
      default: 'h-4 w-4',
      md: 'h-4 w-4',
      sm: 'h-4 w-4',
      form: 'h-4 w-4',
      lg: 'h-[18px] w-[18px]',
      icon: 'h-4 w-4',
    },
  },
});
const buttonGroupStyle = tva({
  base: '',
  variants: {
    space: {
      'xs': 'gap-1',
      'sm': 'gap-2',
      'md': 'gap-3',
      'lg': 'gap-4',
      'xl': 'gap-5',
      '2xl': 'gap-6',
      '3xl': 'gap-7',
      '4xl': 'gap-8',
    },
    isAttached: {
      true: 'gap-0',
    },
    flexDirection: {
      'row': 'flex-row',
      'column': 'flex-col',
      'row-reverse': 'flex-row-reverse',
      'column-reverse': 'flex-col-reverse',
    },
  },
});
type IButtonProps = Omit<
  React.ComponentPropsWithoutRef<typeof UIButton>,
  'context'
> &
  Omit<VariantProps<typeof buttonStyleVariants>, 'variant'> & {
    variant?: ButtonVariantInput;
    className?: string;
  };
const Button = React.forwardRef<
  React.ElementRef<typeof UIButton>,
  IButtonProps
>(({ className, variant = 'primary', size = 'default', ...props }, ref) => {
  const resolved = resolveButtonVariant(variant);
  return (
    <UIButton
      ref={ref}
      {...props}
      className={buttonStyle({ variant: resolved, size, class: className })}
      context={{ variant: resolved, size }}
    />
  );
});
type IButtonTextProps = React.ComponentPropsWithoutRef<typeof UIButton.Text> &
  VariantProps<typeof buttonTextStyle> & { className?: string };
const ButtonText = React.forwardRef<
  React.ElementRef<typeof UIButton.Text>,
  IButtonTextProps
>(({ className, size, ...props }, ref) => {
  const { size: parentSize, variant: parentVariant } = useStyleContext(SCOPE);
  return (
    <UIButton.Text
      ref={ref}
      {...props}
      className={buttonTextStyle({
        parentVariants: {
          size: parentSize,
          variant: parentVariant,
        },
        size,
        class: className,
      })}
    />
  );
});
const ButtonSpinner = React.forwardRef<
  React.ElementRef<typeof UIButton.Spinner>,
  React.ComponentPropsWithoutRef<typeof UIButton.Spinner>
>(({ className, size, ...props }, ref) => {
  const { size: parentSize } = useStyleContext(SCOPE);
  return <UIButton.Spinner ref={ref} {...props} className={buttonSpinnerStyle({ parentVariants: { size: parentSize }, class: className, size })} />;
});
type IButtonIcon = React.ComponentPropsWithoutRef<typeof UIButton.Icon> &
  VariantProps<typeof buttonIconStyle> & {
    className?: string | undefined;
    as?: React.ElementType;
    height?: number;
    width?: number;
  };
const ButtonIcon = React.forwardRef<
  React.ElementRef<typeof UIButton.Icon>,
  IButtonIcon
>(({ className, size, ...props }, ref) => {
  const { size: parentSize, variant: parentVariant } = useStyleContext(SCOPE);
  if (typeof size === 'number') {
    return (
      <UIButton.Icon
        ref={ref}
        {...props}
        className={buttonIconStyle({ class: className })}
        size={size}
      />
    );
  } else if (
    (props.height !== undefined || props.width !== undefined) &&
    size === undefined
  ) {
    return (
      <UIButton.Icon
        ref={ref}
        {...props}
        className={buttonIconStyle({ class: className })}
      />
    );
  }
  return (
    <UIButton.Icon
      {...props}
      className={buttonIconStyle({
        parentVariants: {
          size: parentSize,
          variant: parentVariant,
        },
        size,
        class: className,
      })}
      ref={ref}
    />
  );
});
type IButtonGroupProps = React.ComponentPropsWithoutRef<typeof UIButton.Group> &
  VariantProps<typeof buttonGroupStyle>;
const ButtonGroup = React.forwardRef<
  React.ElementRef<typeof UIButton.Group>,
  IButtonGroupProps
>(
  (
    {
      className,
      space = 'md',
      isAttached = false,
      flexDirection = 'column',
      ...props
    },
    ref
  ) => {
    return (
      <UIButton.Group
        className={buttonGroupStyle({
          class: className,
          space,
          isAttached,
          flexDirection,
        })}
        {...props}
        ref={ref}
      />
    );
  }
);
Button.displayName = 'Button';
ButtonText.displayName = 'ButtonText';
ButtonSpinner.displayName = 'ButtonSpinner';
ButtonIcon.displayName = 'ButtonIcon';
ButtonGroup.displayName = 'ButtonGroup';
export { Button, ButtonText, ButtonSpinner, ButtonIcon, ButtonGroup, buttonStyle };
