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
import { TAP_TARGET_ICON_BOX, TAP_TARGET_MIN_H } from '@/lib/ui/tap-target';
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
// The 44px floor (Apple HIG 44pt / WCAG 2.5.8 AAA) lives HERE, as a default
// in each size variant, deliberately using tva()/twMerge rather than
// ChoicePill's plain-template-literal approach (see
// components/ui/choice-pill/index.tsx's comment for why that one avoids
// tva()). Button keeps tva() on purpose: a call site that explicitly passes
// its own min-h-* (e.g. LandingHeader's min-h-14) should still be able to
// win, and that override is an explicit, greppable, reviewable act in the
// diff — unlike ChoicePill's callers, who pass whole layout classNames and
// could accidentally strip the floor. Do not "unify" these two components.
const buttonStyleVariants = tva({
  base: 'rounded-lg flex-row items-center justify-center gap-2 h-fit web:transition-[color,background-color,border-color,opacity,box-shadow] web:duration-200 motion-reduce:web:transition-none data-[focus-visible=true]:web:outline-none data-[focus-visible=true]:web:ring-2 data-[focus-visible=true]:web:ring-primary/50 data-[disabled=true]:opacity-40',
  variants: {
    variant: {
      default:
        'bg-primary data-[hover=true]:bg-primary/90 data-[active=true]:bg-primary/90',
      destructive:
        'bg-destructive data-[hover=true]:bg-destructive/90 data-[active=true]:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
      outline:
        'border border-border bg-background shadow-xs data-[hover=true]:bg-accent data-[active=true]:bg-accent dark:bg-input/[0.045] dark:border-border/90 dark:data-[hover=true]:bg-input/[0.075] dark:data-[active=true]:bg-input/[0.075]',
      secondary:
        'bg-secondary text-secondary-foreground data-[hover=true]:bg-secondary/80 data-[active=true]:bg-secondary/80',
      ghost: 'data-[hover=true]:bg-accent data-[active=true]:bg-accent dark:data-[hover=true]:bg-accent/50 dark:data-[active=true]:bg-accent/50',
      link: 'text-primary underline-offset-4 data-[hover=true]:underline data-[active=true]:underline',
    },
    size: {
      default: `${TAP_TARGET_MIN_H} px-4 py-2`,
      sm: `${TAP_TARGET_MIN_H} rounded-lg px-3 text-xs`,
      lg: `${TAP_TARGET_MIN_H} rounded-lg px-8`,
      icon: TAP_TARGET_ICON_BOX,
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});
// tva()'s returned function destructures its argument directly, so calling
// it with zero arguments throws instead of resolving to the `default`/
// `default` path. This thin wrapper makes `buttonStyle()` a valid way to ask
// "what does a bare Button render as" (used by tap-target.test.ts), while
// every real call site (below, and any other caller) keeps passing an
// explicit variants object as before.
const buttonStyle: typeof buttonStyleVariants = (props) => buttonStyleVariants(props ?? {});
const buttonTextStyle = tva({
  base: 'web:select-none font-sans',
  parentVariants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-white',
      outline: 'text-foreground data-[hover=true]:text-accent-foreground data-[active=true]:text-accent-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground ',
      link: 'text-primary data-[hover=true]:underline data-[active=true]:underline',
    },
    size: {
      default: 'text-sm',
      sm: 'text-xs',
      lg: 'text-sm',
      icon: 'text-sm',
    },
  },
});

const buttonSpinnerStyle = tva({
  base: '',
  parentVariants: {
    size: {
      default: 'h-4 w-4',
      sm: 'h-4 w-4',
      lg: 'h-4 w-4',
      icon: 'h-4 w-4',
    },
  },
});

const buttonIconStyle = tva({
  base: 'fill-none pointer-events-none shrink-0',
  parentVariants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-white',
      outline:
        'text-foreground data-[hover=true]:text-accent-foreground data-[active=true]:text-accent-foreground',
      secondary: 'text-secondary-foreground',
      ghost:
        'text-foreground data-[hover=true]:text-accent-foreground data-[active=true]:text-accent-foreground',
      link: 'text-primary',
    },
    size: {
      default: 'h-4 w-4',
      sm: 'h-4 w-4',
      lg: 'h-4 w-4',
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
  VariantProps<typeof buttonStyle> & { className?: string };
const Button = React.forwardRef<
  React.ElementRef<typeof UIButton>,
  IButtonProps
>(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  return (
    <UIButton
      ref={ref}
      {...props}
      className={buttonStyle({ variant, size, class: className })}
      context={{ variant, size }}
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
