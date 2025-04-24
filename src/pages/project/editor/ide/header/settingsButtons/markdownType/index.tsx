import { useDispatch, useSelector } from 'react-redux';
import { useActiveSegment } from '../../../../../../../store/selectors/program';
import {
    addSegment,
    addSegmentAfter,
    changeSegmentTextById,
} from '../../../../../../../store/slices/project';

import './style.scss';
import { StorageState } from '../../../../../../../store';
import { HeaderHelpItem, items } from '../help';

export const HeaderHelperItems = () => {
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );
    const prevActiveIndex = useSelector(
        (state: StorageState) => state.ide.previousActiveSegmentIndex
    );
    const activeSegment = useSelector(
        useActiveSegment(prevActiveIndex >= 0 ? prevActiveIndex : 0)
    );
    const dispatch = useDispatch();
    const onClick = (item: HeaderHelpItem) => {
        if (
            prevActiveIndex === -1 ||
            prevActiveIndex === undefined ||
            activeSegment === undefined
        ) {
            dispatch(
                addSegment({
                    id: 0,
                    parameters: {
                        visible: true,
                        hideArray: false,
                        hideAssignmentWithValues: false,
                        hideGeneralFormula: false,
                        hideInflAssignment: false,
                        hideInflAssignmentWithValues: false,
                    },
                    text: item.text[language],
                    type: item.segmentType,
                })
            );
        } else {
            if (activeSegment.type === item.segmentType) {
                const newActiveSegment = { ...activeSegment };
                const text = `${newActiveSegment.text}\n\n${item.text[language]}`;
                dispatch(changeSegmentTextById({ id: prevActiveIndex, text }));
            } else {
                const place = prevActiveIndex >= 1 ? prevActiveIndex - 1 : 0;
                dispatch(
                    addSegmentAfter({
                        segment: {
                            id: 0,
                            parameters: {
                                visible: true,
                                hideArray: false,
                                hideAssignmentWithValues: false,
                                hideGeneralFormula: false,
                                hideInflAssignment: false,
                                hideInflAssignmentWithValues: false,
                            },
                            text: item.text[language],
                            type: item.segmentType,
                        },
                        after: place,
                    })
                );
            }
        }
    };

    return (
        <div className="markdown-select-dropdown">
            {items.map((item) => (
                <span onClick={() => onClick(item)}>
                    {item.description[language]}
                </span>
            ))}
        </div>
    );
};
