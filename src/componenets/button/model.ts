export interface ButtnProps {
  onPress?: (e?: any) => any;
  classname?: string;
  title: string;
  titleIcon?: any;
  minimize: boolean | 'super';
  rounded?: boolean;
  disabled?: boolean;
  color: 'green' | 'blue' | 'gray' | 'inherit';
  type?: 'rounded';
  buttonType?: 'submit' | 'reset';
}
