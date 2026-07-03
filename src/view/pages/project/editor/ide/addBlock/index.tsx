import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../../../../components/button';
import { Typography } from '../../../../../components/typography';
import { PlusIcon } from '../../../../../icons';
import { SegmentType } from '../../../../../../model/domain';

import { AddBlockProps } from './model';
import { InterfaceTourAnchorClassnames } from '../../../../../components/tour/helpers';
import { colors } from '../../../../../styles/colors';
import { useDictionary } from '../../../../../store/selectors/translations';
import { Select } from '../../../../../components/select';
import { SelectClassNames } from '../../../../../components/select/model';
import { AppDispatch } from '../../../../../store';
import { useIsMobile } from '../../../../../hooks/useMobile';
import { controller } from '../../../../../../main.tsx';
import './style.scss';

export const AddBlock = (props: AddBlockProps) => {
    const dispatch = useDispatch<AppDispatch>();
    const isMobile = useIsMobile();
    const dictionary = useSelector(useDictionary);

    const headerSelectOptions = [
        { value: 'md', label: dictionary.label_add_markdown },
        { value: 'computational', label: dictionary.label_add_code },
        { value: 'latex', label: dictionary.label_add_latex },
        { value: 'asciimath', label: dictionary.label_add_asciimath },
    ];

    const emptyProjectSelectOptions = [
        { value: 'md', label: dictionary.label_add_markdown },
        { value: 'computational', label: dictionary.label_add_code },
        { value: 'asciimath', label: dictionary.label_add_asciimath },
    ];

    const addMoreTitle = isMobile
        ? dictionary.label_add_more_short
        : dictionary.label_add_more;

    const onAddSegment = (type: SegmentType) =>
        dispatch(
            controller.onAddSegmentButtonClickedRequest({
                type,
            })
        );

    if (props.isFirst) {
        return (
            <div className="empty-project-placeholder-container">
                <Button
                    classname={InterfaceTourAnchorClassnames.AddCode}
                    title={dictionary.label_add_latex}
                    color="gray"
                    onPress={() => onAddSegment('latex')}
                    minimize={false}
                    titleIcon={() => <PlusIcon />}
                    rounded
                />
                <Typography text={dictionary.or} color={colors.black} />
                <Select
                    options={emptyProjectSelectOptions}
                    title={addMoreTitle}
                    value="computational"
                    onChange={(value) => onAddSegment(value as SegmentType)}
                    className={SelectClassNames.Computation}
                    minimize={false}
                />
            </div>
        );
    }

    return (
        <div className="empty-project-placeholder-container">
            <Select
                options={headerSelectOptions}
                title={addMoreTitle}
                value="md"
                onChange={(value) => onAddSegment(value as SegmentType)}
                className={SelectClassNames.Computation}
                containerClassName={InterfaceTourAnchorClassnames.AddCode}
                minimize
            />
        </div>
    );
};
