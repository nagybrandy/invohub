import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { webDomProps } from '@/components/ui/web-dom-props';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    /** Right-aligned tabular figures for money/quantity columns (4.6). */
    numeric?: boolean;
    /** RN's `selectable` — on web it becomes the `select-text` class. */
    selectable?: boolean;
    /** RN's `numberOfLines` — on web it becomes `truncate` (1) or `line-clamp-N` (2-3). */
    numberOfLines?: number;
  };

// Literal class names so Tailwind's scanner keeps them.
const LINE_CLAMP: Record<number, string> = { 1: 'truncate', 2: 'line-clamp-2', 3: 'line-clamp-3' };

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
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
      selectable,
      numberOfLines,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    return (
      <span
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: [numeric ? 'tabular-nums text-right' : '', selectable ? 'select-text' : '', numberOfLines ? LINE_CLAMP[numberOfLines] ?? 'line-clamp-3' : '', className ?? '']
            .filter(Boolean)
            .join(' '),
        })}
        {...webDomProps(props)}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
