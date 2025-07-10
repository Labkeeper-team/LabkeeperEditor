import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import classNames from 'classnames';
import { useDictionary } from '../../../../../../../viewModel/store/selectors/translations';

import { SegmentType } from '../../../../../../../model/domain.ts';
import { observerService } from '../../../../../../../main.tsx';
import {
    Events,
    EventValues,
} from '../../../../../../../model/service/observer.ts';

import './style.scss';

interface EditorTypeDivider {
    type: SegmentType;
    text: string;
    event1: EventValues;
    event2?: EventValues;
}
interface SegmentDividerProps {
    onAdd: (type: SegmentType) => void;
}

export const SegmentDivider: React.FC<SegmentDividerProps> = ({ onAdd }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dictionary = useSelector(useDictionary);

    const createOnClick = useCallback((
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
    }, [onAdd]);

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
