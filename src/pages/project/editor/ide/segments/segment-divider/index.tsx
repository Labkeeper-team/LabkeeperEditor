import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../../store/selectors/translations';
import './style.scss';

interface SegmentDividerProps {
    onAddComputation: () => void;
    onAddText: () => void;
}

export const SegmentDivider: React.FC<SegmentDividerProps> = ({
    onAddComputation,
    onAddText,
}) => {
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
                                onAddText();
                                setIsOpen(false);
                            }}
                        >
                            {dictionary.segment_divider.markdown}
                        </button>
                        <button
                            onClick={() => {
                                onAddComputation();
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
