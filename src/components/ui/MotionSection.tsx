import { motion } from 'framer-motion';
import type { CSSProperties, KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Props = {
  children?: ReactNode;
  className?: string;
  id?: string;
  role?: string;
  style?: CSSProperties;
  delay?: number;
  staggerIndex?: number;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  tabIndex?: number;
  'data-testid'?: string;
};

/** Dashboard / platform section wrapper — unified fadeUp entrance animation. */
export function MotionSection({
  children,
  className,
  delay = 0,
  staggerIndex,
  onClick,
  onKeyDown,
  tabIndex,
  id,
  role,
  style,
  'data-testid': dataTestId,
}: Props) {
  const resolvedDelay = staggerIndex !== undefined ? staggerIndex * 0.06 : delay;

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const htmlProps = {
    className: cn(className),
    onClick,
    onKeyDown,
    tabIndex,
    id,
    role,
    style,
    'data-testid': dataTestId,
  };

  if (prefersReduced) {
    return <div {...htmlProps}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1], delay: resolvedDelay }}
      {...htmlProps}
    >
      {children}
    </motion.div>
  );
}
