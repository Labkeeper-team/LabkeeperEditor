import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../../../../components/button';
import { Typography } from '../../../../../components/typography';
import { PlusIcon } from '../../../../../shared/icons';
import './style.scss';
import { Program, Segment } from '../../../../../shared/models/project';
import { useCallback } from 'react';
import { addSegment, setNewProgram } from '../../../../../store/slices/project';
import { AddBlockProps } from './model';
import { InterfaceTourAnchorClassnames } from '../../../../../shared/components/tour/helpers';
import { useCurrentProgram } from '../../../../../store/selectors/program';
import { colors } from '../../../../../shared/styles/colors';
import { useDictionary } from '../../../../../store/selectors/translations';
import { setActiveSegmentIndex } from '../../../../../store/slices/ide';

export const AddBlock = (props: AddBlockProps) => {
    const dispatch = useDispatch();
    const program = useSelector(useCurrentProgram);
    const dictionary = useSelector(useDictionary);

    const onClick = useCallback(
        (type: 'computational' | 'md') => {
            const newSegment: Segment = {
                id: 1,
                type,
                parameters: {
                    visible: true,
                },
                text: '',
            };
            if (!program) {
                newSegment.id = 1;
                const newProgram: Program = {
                    segments: [newSegment],
                    parameters: {
                        roundStrategy: 'firstMeaningDigit',
                    },
                };
                dispatch(setNewProgram(newProgram));
                dispatch(setActiveSegmentIndex(1));
            } else {
                dispatch(addSegment(newSegment));
                const maxId = Math.max(
                    ...program.segments.map((s) => s.id ?? 0)
                );
                dispatch(setActiveSegmentIndex(maxId + 1));
            }
        },
        [program, dispatch]
    );

    return (
        <div className="empty-project-placeholder-container">
            <Button
                classname={InterfaceTourAnchorClassnames.AddCode}
                title={dictionary.label_add_code}
                color="gray"
                onPress={() => onClick('computational')}
                minimize={!props.isFirst}
                titleIcon={PlusIcon}
                rounded
            />
            {props.isFirst ? (
                <Typography text={dictionary.or} color={colors.black} />
            ) : null}
            <Button
                classname={InterfaceTourAnchorClassnames.AddMarkdown}
                title={dictionary.label_add_markdown}
                color="gray"
                onPress={() => onClick('md')}
                minimize={!props.isFirst}
                titleIcon={PlusIcon}
                rounded
            />
        </div>
    );
};
