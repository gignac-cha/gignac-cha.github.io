type Union<S = string, T extends string | number = string> = T | Omit<S, T>;
type Responsive<T> = T | Partial<Record<Breakpoint, T>>;
