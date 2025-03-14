import { Typography } from '../../../../../componenets/typography';
import { colors } from '../../../../../shared/styles/colors';

export const InstructionItem = (props: { index: number; title: string }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <Typography text={props.title} color={colors.gray10} type="body-large" />
      <img src={`/instructions/instruction_${props.index}.png`} />
    </div>
  );
};
