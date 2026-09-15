import React from 'react';

import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { Text as RNText } from 'react-native';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<typeof RNText> &
  VariantProps<typeof textStyle> & {
    /** Right-aligned tabular figures for money/quantity columns (4.6). */
    numeric?: boolean;
  };

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      numeric,
      style,
      ...props
    },
    ref
  ) {
    return (
      <RNText
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: numeric ? `tabular-nums text-right ${className ?? ''}` : className,
        })}
        style={
          numeric
            ? [{ fontVariant: ['tabular-nums'] as const }, style]
            : style
        }
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
