import { useSelector } from 'react-redux';
import { Typography } from '../../../../../componenets/typography';
import { WarningIcon } from '../../../../../shared/icons';
import { CompileError, OperatorExcepctedpayload, QuotaPayload } from '../../../../../shared/models/project';
import { colors } from '../../../../../shared/styles/colors';
import { ErrorItemProps } from './model';
import { useDictionary } from '../../../../../store/selectors/translations';

export const ErrorItem = ({code, payload}: ErrorItemProps) => {
  const dictionary = useSelector(useDictionary)
  const quotaPayload = payload as any as QuotaPayload;
  const operatorExpectedPayload = payload as any as OperatorExcepctedpayload;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <WarningIcon />
      {<Typography color={colors.gray10} text={`${dictionary.compile_error[code]}`} />}
      <span style={{ color: colors.errorLine, fontSize: 12 }}>
        {Number.isNaN(+payload.line) ? '' : `${dictionary.error_common.line} ${payload.line + 1}${payload.position !== undefined ? `.${payload.position}` : ''}`}
        {code === CompileError.QUOTA_EXCEEDED ? <span>{dictionary.quota_definition[quotaPayload.quotaIndex]}: {dictionary.error_common.now}: {quotaPayload.value}; {dictionary.error_common.max}: {quotaPayload.limit}</span> : null}
        {code === CompileError.OPERATOR_EXPECTED ? <span>
          &nbsp;{dictionary.error_common.operator_expected}: {typeof operatorExpectedPayload.operators === 'string'
            ? `${operatorExpectedPayload.operators === '\n' ? dictionary.error_common.new_line : operatorExpectedPayload.operators}`
            :  operatorExpectedPayload.operators.join(', ')}
            </span>
        : null}
        {code === CompileError.NO_SUCH_VARIABLE ? <span>&nbsp;{dictionary.error_common.variable} {(payload as any).variable}</span> : null}

      </span>
    </div>
  );
};
