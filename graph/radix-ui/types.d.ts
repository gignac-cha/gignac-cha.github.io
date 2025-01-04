declare type Union<S = string, T extends string | number = string> = T | Omit<S, T>;
const breakpoints = ['initial', 'xs', 'sm', 'md', 'lg', 'xl'] as const;
type Breakpoint = (typeof breakpoints)[number];
declare type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

declare namespace Radix.Number {
  type Zero = 0;
  type Positive = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  type Negative = -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9;
}
