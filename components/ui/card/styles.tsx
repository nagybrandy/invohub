// components/ui/card/styles.tsx
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { isWeb } from '@gluestack-ui/utils/nativewind-utils';
const baseStyle = isWeb ? 'flex flex-col relative z-0' : '';

export const cardStyle = tva({
  base: `${baseStyle} flex-col bg-surface rounded-card shadow-card`,
  variants: {
    size: {
      default: 'px-[22px] py-5 gap-6',
      sm: 'p-3 gap-3',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});
