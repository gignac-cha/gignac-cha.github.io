type Child = string | HTMLElement | DocumentFragment;
type Children = Child[];

type HTMLElementTagName = keyof HTMLElementTagNameMap;

type Component<N extends HTMLElementTagName> = (...children: Children) => HTMLElementTagNameMap[N];

type Attributes<N extends HTMLElementTagName, E = HTMLElementTagNameMap[N]> = Partial<
  Omit<{ [K in keyof E]: E[K] }, 'style' | 'classList'> & {
    style: Partial<CSSStyleDeclaration>;
  } & {
    classList: (string | undefined | 0 | false)[];
  }
>;

declare type CreateElementFunction<N extends HTMLElementTagName> = (attributes?: {
  [K in keyof HTMLElementTagNameMap[N]]?: HTMLElementTagNameMap[N][K];
}) => Component<N>;
declare type CreateElementGeneralFunction = <N extends HTMLElementTagName>(tagName: N) => CreateElementFunction<N>;
