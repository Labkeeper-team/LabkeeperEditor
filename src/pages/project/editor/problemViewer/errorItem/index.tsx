import {useSelector} from 'react-redux';
import {Typography} from '../../../../../componenets/typography';
import {WarningIcon} from '../../../../../shared/icons';
import {
    CompileError,
    FunctionErrorPayload,
    NoSuchVariablePayload,
    OperatorExcepctedpayload,
    QuotaPayload
} from '../../../../../shared/models/project';
import {colors} from '../../../../../shared/styles/colors';
import {ErrorItemProps} from './model';
import {useDictionary} from '../../../../../store/selectors/translations';

export const ErrorItem = ({code, payload}: ErrorItemProps) => {
  const dictionary = useSelector(useDictionary)
  const quotaPayload = payload as any as QuotaPayload;
  const operatorExpectedPayload = payload as any as OperatorExcepctedpayload;
  const functionErrorPayload = payload as any as FunctionErrorPayload;
  const noSuchVariablePayload = payload as any as NoSuchVariablePayload;
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
      <Typography color={colors.gray10} text={
          dictionary.compile_error[code]
          + (code === CompileError.QUOTA_EXCEEDED ? `. ${dictionary.quota_definition[quotaPayload.quotaIndex]}. ${dictionary.error_common.now}: ${quotaPayload.value}; ${dictionary.error_common.max}: ${quotaPayload.limit}` : '')
          + (code === CompileError.OPERATOR_EXPECTED ? ' ' + operatorExpectedPayload.operators.join(' ') : '')
          + (code === CompileError.NO_SUCH_VARIABLE ? ' ' + noSuchVariablePayload.variable : '')
          + ((code === CompileError.INCORRECT_ARGUMENT_SIZE ||
              code === CompileError.INCORRECT_ARGUMENTS_COUNT ||
              code === CompileError.INCORRECT_ARGUMENT ||
              code === CompileError.STRING_ARGUMENT_EXPECTED ||
              code === CompileError.ARRAY_ARGUMENT_EXPECTED ||
              code === CompileError.NO_SUCH_FUNCTION || code === CompileError.FUNCTION_HAS_NO_RETURN_VALUE) ? ` ${functionErrorPayload.functionName}` : '')
      }/>
      <span style={{ color: colors.errorLine, fontSize: 12 }}>
        {Number.isNaN(+payload.line) ? '' : `${dictionary.error_common.line} ${payload.line + 1}${payload.position !== undefined ? `.${payload.position}` : ''}`}
      </span>
    </div>
  );
};
