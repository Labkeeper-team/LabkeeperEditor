import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../../../viewModel/store/selectors/translations';
import './style.scss';
import { SegmentType } from '../../../../../../../model/domain.ts';
import { observerService } from '../../../../../../../main.tsx';
import { Events } from '../../../../../../../model/service/observer.ts';

interface SegmentDividerProps {
    onAdd: (type: SegmentType) => void;
}

export const SegmentDivider: React.FC<SegmentDividerProps> = ({ onAdd }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dictionary = useSelector(useDictionary);

    return (
        <div className="segment-divider">
            <div className="divider-line" />
            <div className="divider-button-container">
                <button
                    className={`divider-button ${isOpen ? 'active' : ''}`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {dictionary.segment_divider.add}
                </button>
                {isOpen && (
                    <div
                        className="divider-dropdown"
                        onMouseLeave={() => setIsOpen(false)}
                    >
                        <button
                            onClick={() => {
                                observerService.onEvent(
                                    Events.EVENT_INSERT_SEGMENT_BETWEEN
                                );
                                observerService.onEvent(
                                    Events.EVENT_CREATE_MD_SEGMENT
                                );
                                onAdd('md');
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.markdown}
                        </button>
                        <button
                            onClick={() => {
                                observerService.onEvent(
                                    Events.EVENT_CREATE_LATEX_SEGMENT
                                );
                                observerService.onEvent(
                                    Events.EVENT_INSERT_SEGMENT_BETWEEN
                                );
                                onAdd('latex');
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.latex}
                        </button>
                        <button
                            onClick={() => {
                                observerService.onEvent(
                                    Events.EVENT_CREATE_ASCIIMATH_SEGMENT
                                );
                                observerService.onEvent(
                                    Events.EVENT_INSERT_SEGMENT_BETWEEN
                                );
                                onAdd('asciimath');
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.asciimath}
                        </button>
                        <button
                            onClick={() => {
                                observerService.onEvent(
                                    Events.EVENT_CREATE_COMP_SEGMENT
                                );
                                observerService.onEvent(
                                    Events.EVENT_INSERT_SEGMENT_BETWEEN
                                );
                                onAdd('computational');
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.computation}
                        </button>
                    </div>
                )}
            </div>
            <div className="divider-line" />
        </div>
    );
};
