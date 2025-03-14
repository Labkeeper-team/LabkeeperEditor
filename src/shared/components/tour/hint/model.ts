export interface HintProps {
  text: string;
  hintPosition:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end';
  anchor: string;
  position: { top?: number; bottom?: number; left?: number; right?: number };
}
