import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '../../../../../../../components/checkbox';
import { Typography } from '../../../../../../../components/typography';
import { PlusIcon } from '../../../../../../../icons';
import { useDictionary } from '../../../../../../../store/selectors/translations';
import { AppDispatch } from '../../../../../../../store';
import { colors } from '../../../../../../../styles/colors';
import {
    ClickCheckboxParameter,
    DropdownSegmentMenuContentProps,
} from './model';
import { useMemo } from 'react';
import { controller } from '../../../../../../../../controller.ts';

export const DropdownMenuContent = ({
    index,
    segment,
}: DropdownSegmentMenuContentProps) => {
    const dispatch = useDispatch<AppDispatch>();

    const dictionary = useSelector(useDictionary);

    const onCreateClickCheckox = (parameter: ClickCheckboxParameter) => {
        return (v: boolean) => {
            dispatch(
                controller.segmentEditorChangeSegmentVisibilityRequest({
                    segmentIndex: index,
                    parameterName: parameter,
                    visible: v,
                })
            );
        };
    };

    const onDeleteClick = () => {
        dispatch(
            controller.deleteSegmentRequest({
                segmentIndex: index,
            })
        );
    };

    const isSegmentIsNotComputational = useMemo(() => {
        return segment.type !== 'computational';
    }, [segment.type]);

    return (
        <>
            <div onClick={onDeleteClick} className="delete-segment-container">
                <div className="delete-icon">
                    <PlusIcon />
                </div>
                <Typography color={colors.gray10} text={dictionary.delete} />
            </div>
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`visibility-segment-${index}`}
                checked={!!segment.parameters.visible}
                onChange={onCreateClickCheckox('visible')}
                title={dictionary.segment.visible}
            />
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`assignment-${index}`}
                checked={!!segment.parameters.hideAssignment}
                onChange={onCreateClickCheckox('hideAssignment')}
                title={dictionary.segment.hide_assignment}
            />
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`valued-assignment-${index}`}
                checked={!!segment.parameters.hideAssignmentWithValues}
                onChange={onCreateClickCheckox('hideAssignmentWithValues')}
                title={dictionary.segment.hide_assignment_with_values}
            />
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`value-${index}`}
                checked={!!segment.parameters.hideValue}
                onChange={onCreateClickCheckox('hideValue')}
                title={dictionary.segment.hide_value}
            />
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`general-${index}`}
                checked={!!segment.parameters.hideGeneralFormula}
                onChange={onCreateClickCheckox('hideGeneralFormula')}
                title={dictionary.segment.hide_general_formula}
            />
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`infl-assig-${index}`}
                checked={!!segment.parameters.hideInflAssignment}
                onChange={onCreateClickCheckox('hideInflAssignment')}
                title={dictionary.segment.hide_infl_assignment}
            />
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`infl-assig-with-values-${index}`}
                checked={!!segment.parameters.hideInflAssignmentWithValues}
                onChange={onCreateClickCheckox('hideInflAssignmentWithValues')}
                title={dictionary.segment.hide_infl_assignment_with_values}
            />
            <Checkbox
                hidden={isSegmentIsNotComputational}
                className="full-width-checkbox"
                id={`infl-${index}`}
                checked={!!segment.parameters.hideInfl}
                onChange={onCreateClickCheckox('hideInfl')}
                title={dictionary.segment.hide_infl}
            />
        </>
    );
};
