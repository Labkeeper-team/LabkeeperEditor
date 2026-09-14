import { useDispatch, useSelector } from 'react-redux';
import { Typography } from '../../../../../components/typography';
import { WarningIcon } from '../../../../../icons';
import {
    describeCompileError,
    describeErrorLine,
} from '../../../../../../viewModel/utils/compileErrors.ts';
import { colors } from '../../../../../styles/colors';
import { ErrorItemProps } from './model';
import { useDictionary } from '../../../../../store/selectors/translations';
import { AppDispatch } from '../../../../../store';
import { controller } from '../../../../../../main.tsx';

import './style.scss';

export const ErrorItem = ({ code, payload }: ErrorItemProps) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const canNavigate =
        !Number.isNaN(+payload.line) &&
        (Boolean(payload.latexFile) || payload.segmentId != null);

    const onClick = () => {
        if (!canNavigate) {
            return;
        }
        dispatch(
            controller.onCompileErrorClickedRequest({
                code,
                payload,
            })
        );
    };

    return (
        <div
            className={
                canNavigate ? 'error-item error-item--clickable' : 'error-item'
            }
            onClick={onClick}
            role={canNavigate ? 'button' : undefined}
            tabIndex={canNavigate ? 0 : undefined}
            onKeyDown={
                canNavigate
                    ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onClick();
                          }
                      }
                    : undefined
            }
        >
            <WarningIcon />
            <Typography
                color={colors.gray10}
                text={describeCompileError({ code, payload }, dictionary)}
            />
            <span style={{ color: colors.errorLine, fontSize: 12 }}>
                {describeErrorLine(payload, dictionary)}
            </span>
        </div>
    );
};
