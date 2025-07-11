import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import { useDictionary } from '../../../../../../../viewModel/store/selectors/translations';

import { SegmentType } from '../../../../../../../model/domain.ts';
import { observerService } from '../../../../../../../main.tsx';
import {
    Events,
    EventValues,
} from '../../../../../../../model/service/observer.ts';
import { AppDispatch } from '../../../../../../../viewModel/store/index.ts';
import { onSegmentAddedViaDividerRequest } from '../../../../../../../controller/index.ts';
import { EditorTypeDivider, SegmentDividerProps } from './model.ts';
import { createEmptySegment } from '../../../../../../helpers/index.ts';

import './style.scss';

export const SegmentDivider: React.FC<SegmentDividerProps> = ({
    showDivider,
    index,
}) => {
    const dispatch = useDispatch<AppDispatch>();

    const [isOpen, setIsOpen] = useState(false);
    const dictionary = useSelector(useDictionary);

    const onAdd = useCallback(
        (type: SegmentType) => {
            const segmentViaDividerRequestObj = {
                segment: createEmptySegment(type),
                after: index,
            };
            dispatch(
                onSegmentAddedViaDividerRequest(segmentViaDividerRequestObj)
            );
        },
        [index, dispatch]
    );

    const createOnClick = useCallback(
        (
            type: SegmentType,
            observerEvent1: EventValues,
            observerEvent2: EventValues = Events.EVENT_INSERT_SEGMENT_BETWEEN
        ) => {
            return () => {
                observerService.onEvent(observerEvent1);
                observerService.onEvent(observerEvent2);
                onAdd(type);
                setIsOpen(false);
            };
        },
        [onAdd]
    );

    const editorTypes: EditorTypeDivider[] = useMemo(
        () => [
            {
                type: 'md',
                text: dictionary.segment_divider.markdown,
                event1: Events.EVENT_INSERT_SEGMENT_BETWEEN,
                event2: Events.EVENT_CREATE_MD_SEGMENT,
            },
            {
                type: 'latex',
                text: dictionary.segment_divider.latex,
                event1: Events.EVENT_CREATE_LATEX_SEGMENT,
            },
            {
                type: 'asciimath',
                text: dictionary.segment_divider.asciimath,
                event1: Events.EVENT_CREATE_ASCIIMATH_SEGMENT,
            },
            {
                type: 'computational',
                text: dictionary.segment_divider.computation,
                event1: Events.EVENT_CREATE_COMP_SEGMENT,
            },
        ],
        [dictionary]
    );
    if (!showDivider) {
        return <div style={{ flex: 1 }} />;
    }
    return (
        <div className="segment-divider">
            <div className="divider-line" />
            <div className="divider-button-container">
                <button
                    className={classNames('divider-button', { active: isOpen })}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {dictionary.segment_divider.add}
                </button>
                {isOpen && (
                    <div
                        className="divider-dropdown"
                        onMouseLeave={() => setIsOpen(false)}
                    >
                        {editorTypes.map(({ type, text, event1, event2 }) => {
                            return (
                                <button
                                    key={type}
                                    onClick={createOnClick(
                                        type,
                                        event1,
                                        event2
                                    )}
                                >
                                    {text}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="divider-line" />
        </div>
    );
};
