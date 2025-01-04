// declare namespace Radix {
//   interface LayoutOptions {
//     p: Responsive<Union<string, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>>;
//     px: Responsive<Union<string, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>>;
//     py: Responsive<Union<string, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>>;
//     pt: Responsive<Union<string, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>>;
//     pr: Responsive<Union<string, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>>;
//     pb: Responsive<Union<string, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>>;
//     pl: Responsive<Union<string, '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'>>;
//     width: Responsive<string>;
//     minWidth: Responsive<string>;
//     maxWidth: Responsive<string>;
//     height: Responsive<string>;
//     minHeight: Responsive<string>;
//     maxHeight: Responsive<string>;
//     position: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;
//     inset: Responsive<
//       Union<
//         string,
//         | '0'
//         | '1'
//         | '2'
//         | '3'
//         | '4'
//         | '5'
//         | '6'
//         | '7'
//         | '8'
//         | '9'
//         | '-1'
//         | '-2'
//         | '-3'
//         | '-4'
//         | '-5'
//         | '-6'
//         | '-7'
//         | '-8'
//         | '-9'
//       >
//     >;
//     top: Responsive<
//       Union<
//         string,
//         | '0'
//         | '1'
//         | '2'
//         | '3'
//         | '4'
//         | '5'
//         | '6'
//         | '7'
//         | '8'
//         | '9'
//         | '-1'
//         | '-2'
//         | '-3'
//         | '-4'
//         | '-5'
//         | '-6'
//         | '-7'
//         | '-8'
//         | '-9'
//       >
//     >;
//     right: Responsive<
//       Union<
//         string,
//         | '0'
//         | '1'
//         | '2'
//         | '3'
//         | '4'
//         | '5'
//         | '6'
//         | '7'
//         | '8'
//         | '9'
//         | '-1'
//         | '-2'
//         | '-3'
//         | '-4'
//         | '-5'
//         | '-6'
//         | '-7'
//         | '-8'
//         | '-9'
//       >
//     >;
//     bottom: Responsive<
//       Union<
//         string,
//         | '0'
//         | '1'
//         | '2'
//         | '3'
//         | '4'
//         | '5'
//         | '6'
//         | '7'
//         | '8'
//         | '9'
//         | '-1'
//         | '-2'
//         | '-3'
//         | '-4'
//         | '-5'
//         | '-6'
//         | '-7'
//         | '-8'
//         | '-9'
//       >
//     >;
//     left: Responsive<
//       Union<
//         string,
//         | '0'
//         | '1'
//         | '2'
//         | '3'
//         | '4'
//         | '5'
//         | '6'
//         | '7'
//         | '8'
//         | '9'
//         | '-1'
//         | '-2'
//         | '-3'
//         | '-4'
//         | '-5'
//         | '-6'
//         | '-7'
//         | '-8'
//         | '-9'
//       >
//     >;
//     overflow: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>;
//     overflowX: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>;
//     overflowY: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>;
//     flexBasis: Responsive<string>;
//     flexShrink: Responsive<Union<string, '0' | '1'>>;
//     flexGrow: Responsive<Union<string, '0' | '1'>>;
//     gridArea: Responsive<string>;
//     gridColumn: Responsive<string>;
//     gridColumnStart: Responsive<string>;
//     gridColumnEnd: Responsive<string>;
//     gridRow: Responsive<string>;
//     gridRowStart: Responsive<string>;
//     gridRowEnd: Responsive<string>;
//   }
// }

declare namespace Radix {
  interface LayoutOptions {
    p: Responsive<Union<string, Number.Zero | Number.Positive | Number.Negative>>;
    px: Responsive<Union<string, Number.Zero | Number.Positive>>;
    py: Responsive<Union<string, Number.Zero | Number.Positive>>;
    pt: Responsive<Union<string, Number.Zero | Number.Positive>>;
    pr: Responsive<Union<string, Number.Zero | Number.Positive>>;
    pb: Responsive<Union<string, Number.Zero | Number.Positive>>;
    pl: Responsive<Union<string, Number.Zero | Number.Positive>>;
    width: Responsive<string>;
    minWidth: Responsive<string>;
    maxWidth: Responsive<string>;
    height: Responsive<string>;
    minHeight: Responsive<string>;
    maxHeight: Responsive<string>;
    position: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;
    inset: Responsive<Union<string, Number.Zero | Number.Positive | Number.Negative>>;
    top: Responsive<Union<string, Number.Zero | Number.Positive | Number.Negative>>;
    right: Responsive<Union<string, Number.Zero | Number.Positive | Number.Negative>>;
    bottom: Responsive<Union<string, Number.Zero | Number.Positive | Number.Negative>>;
    left: Responsive<Union<string, Number.Zero | Number.Positive | Number.Negative>>;
    overflow: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>;
    overflowX: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>;
    overflowY: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>;
    flexBasis: Responsive<string>;
    flexShrink: Responsive<Union<string, '0' | '1'>>;
    flexGrow: Responsive<Union<string, '0' | '1'>>;
    gridArea: Responsive<string>;
    gridColumn: Responsive<string>;
    gridColumnStart: Responsive<string>;
    gridColumnEnd: Responsive<string>;
    gridRow: Responsive<string>;
    gridRowStart: Responsive<string>;
    gridRowEnd: Responsive<string>;
  }
}
