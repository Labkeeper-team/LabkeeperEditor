import { useState } from 'react';
import { CompileErrorResult } from '../../../../../../model/domain';
import { Typography } from '../../../../../components/typography';
import { ErrorItem } from '../errorItem';
import { colors } from '../../../../../styles/colors';
import { ExpandIcon } from '../../../../../icons';

import './style.scss';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../../viewModel/store/selectors/translations';

export const ErrorGroupedItem = (props: {
    segmentId: number;
    errors: CompileErrorResult[];
}) => {
    const [expanded, setExpanded] = useState(true);
    const dictionary = useSelector(useDictionary);
    return (
        <div>
            <div
                onClick={() => setExpanded(!expanded)}
                className="error-group-item-container"
            >
                <div style={{ rotate: expanded ? '180deg' : undefined }}>
                    <ExpandIcon height={12} width={12} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: 3 }}>
                    <Typography
                        color={colors.gray10}
                        type="body-large"
                        text={`${dictionary.error_common.segment} №${props.segmentId}`}
                    />
                    <Typography
                        color={colors.red10}
                        type="body-large"
                        text={`(${props.errors.length})`}
                    />
                </div>
            </div>
            {expanded ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        borderLeft: '1px solid black',
                        marginLeft: 4.5,
                        paddingLeft: 13,
                    }}
                >
                    {props.errors.map((err, index) => {
                        return (
                            <ErrorItem
                                key={`${err.code}-${index}`}
                                code={err.code}
                                payload={err.payload}
                            />
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
};
