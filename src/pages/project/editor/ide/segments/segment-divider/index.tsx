import React, { useState } from 'react';
import './style.scss';

interface SegmentDividerProps {
  onAddComputation: () => void;
  onAddText: () => void;
}

export const SegmentDivider: React.FC<SegmentDividerProps> = ({ onAddComputation, onAddText }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="segment-divider">
      <div className="divider-line" />
      <div className="divider-button-container">
        <button 
          className={`divider-button ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          +
        </button>
        {isOpen && (
          <div className="divider-dropdown">
            <button onClick={() => { onAddComputation(); setIsOpen(false); }}>
              Add computation
            </button>
            <button onClick={() => { onAddText(); setIsOpen(false); }}>
              Add text
            </button>
          </div>
        )}
      </div>
      <div className="divider-line" />
    </div>
  );
}; 