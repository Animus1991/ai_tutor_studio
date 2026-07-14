declare module 'react-konva' {
  import type { ComponentType, ReactNode } from 'react';

  export interface KonvaNodeProps {
    [key: string]: unknown;
  }

  export const Stage: ComponentType<KonvaNodeProps & { children?: ReactNode }>;
  export const Layer: ComponentType<KonvaNodeProps & { children?: ReactNode }>;
  export const Line: ComponentType<KonvaNodeProps>;
  export const Rect: ComponentType<KonvaNodeProps>;
  export const Text: ComponentType<KonvaNodeProps>;
  export const Group: ComponentType<KonvaNodeProps & { children?: ReactNode }>;
}
