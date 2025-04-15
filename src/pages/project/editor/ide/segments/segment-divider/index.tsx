import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../../store/selectors/translations';
import './style.scss';
import { SegmentType } from '../../../../../../shared/models/project.ts';

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
                                onAdd('md');
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.markdown}
                        </button>
                        <button
                            onClick={() => {
                                onAdd('latex');
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.latex}
                        </button>
                        <button
                            onClick={() => {
                                onAdd('asciimath');
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.asciimath}
                        </button>
                        <button
                            onClick={() => {
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
