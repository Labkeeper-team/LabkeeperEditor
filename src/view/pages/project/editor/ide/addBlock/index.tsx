/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../../../../components/button';
import { Typography } from '../../../../../components/typography';
import { PlusIcon } from '../../../../../icons';
import './style.scss';
import { SegmentType } from '../../../../../../model/domain';

import { AddBlockProps } from './model';
import { InterfaceTourAnchorClassnames } from '../../../../../components/tour/helpers';
import { colors } from '../../../../../styles/colors';
import { useDictionary } from '../../../../../../viewModel/store/selectors/translations';
import { Select } from '../../../../../components/select';
import { SelectClassNames } from '../../../../../components/select/model';
import { onAddSegmentButtonClickedRequest } from '../../../../../../controller';
import { AppDispatch } from '../../../../../../viewModel/store';
import classNames from 'classnames';

export const AddBlock = (props: AddBlockProps) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);

    const selectOptions = [
        { value: 'computational', label: dictionary.label_add_code },
        { value: 'latex', label: dictionary.label_add_latex },
        { value: 'asciimath', label: dictionary.label_add_asciimath },
    ];

    return (
        <div className="empty-project-placeholder-container">
            <Button
                classname={classNames(InterfaceTourAnchorClassnames.AddCode, {
                    'desktop-display': !props.isFirst,
                })}
                title={dictionary.label_add_markdown}
                color="gray"
                onPress={() =>
                    dispatch(onAddSegmentButtonClickedRequest({ type: 'md' }))
                }
                minimize={!props.isFirst}
                titleIcon={() => <PlusIcon />}
                rounded
            />
            {!props.isFirst ? (
                <Button
                    classname={classNames(
                        InterfaceTourAnchorClassnames.AddCode,
                        { 'mobile-display': !props.isFirst }
                    )}
                    title={dictionary.label_add_markdown_short}
                    color="gray"
                    onPress={() =>
                        dispatch(
                            onAddSegmentButtonClickedRequest({ type: 'md' })
                        )
                    }
                    minimize={!props.isFirst}
                    titleIcon={() => <PlusIcon />}
                    rounded
                />
            ) : null}
            {props.isFirst && (
                <Typography text={dictionary.or} color={colors.black} />
            )}
            <Select
                options={selectOptions}
                title={dictionary.label_add_more}
                value="computational"
                onChange={(value) =>
                    dispatch(
                        onAddSegmentButtonClickedRequest({
                            type: value as SegmentType,
                        })
                    )
                }
                className={
                    classNames(SelectClassNames.Computation, {
                        'desktop-display': !props.isFirst,
                    }) as any
                }
                minimize={!props.isFirst}
            />
            {!props.isFirst ? (
                <Select
                    options={selectOptions}
                    title={dictionary.label_add_more_short}
                    value="computational"
                    onChange={(value) =>
                        dispatch(
                            onAddSegmentButtonClickedRequest({
                                type: value as SegmentType,
                            })
                        )
                    }
                    className={
                        classNames(SelectClassNames.Computation, {
                            'mobile-display': !props.isFirst,
                        }) as any
                    }
                    minimize={!props.isFirst}
                />
            ) : null}
        </div>
    );
};
