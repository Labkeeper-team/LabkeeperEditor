import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import { useDictionary } from '../../../../../../store/selectors/translations';

import { SegmentType } from '../../../../../../../model/domain.ts';
import { controller } from '../../../../../../../controller.tsx';
import { AppDispatch } from '../../../../../../store';
import { EditorTypeDivider, SegmentDividerProps } from './model.ts';

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
            dispatch(
                controller.onSegmentAddedViaDividerRequest({
                    after: index,
                    segmentType: type,
                })
            );
        },
        [index, dispatch]
    );

    const createOnClick = useCallback(
        (type: SegmentType) => {
            return () => {
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
            },
            {
                type: 'latex',
                text: dictionary.segment_divider.latex,
            },
            {
                type: 'asciimath',
                text: dictionary.segment_divider.asciimath,
            },
            {
                type: 'computational',
                text: dictionary.segment_divider.computation,
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
                        {editorTypes.map(({ type, text }) => {
                            return (
                                <button
                                    key={type}
                                    onClick={createOnClick(type)}
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
