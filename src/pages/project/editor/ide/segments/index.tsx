import {useDispatch, useSelector} from 'react-redux';
import { SegmentEditor } from './segment';
import { SegmentDivider } from './segment-divider';

import './style.scss';
import { useCurrentProgram } from '../../../../../store/selectors/program';
import { useEffect, useRef } from 'react';
import {Segment} from "../../../../../shared/models/project.ts";
import {addSegmentAfter} from "../../../../../store/slices/project";

export const Segments = () => {
  const program = useSelector(useCurrentProgram);
  const ref = useRef(null);
  const dispatch = useDispatch()

  useEffect(() => {
    if (ref.current) {
      (ref.current as any).scrollTo({
        top: 100000,
        behavior: "smooth",
      });
    }
  }, [program.segments.length, ref.current]);

  const handleAddComputation = (index: number) => {
    const newSegment: Segment = {
      type: 'computational',
      parameters: {
        visible: true,
      },
      text: '',
    };
    dispatch(addSegmentAfter({segment: newSegment, after: index}))
  };

  const handleAddText = (index: number) => {
    const newSegment: Segment = {
      type: 'md',
      parameters: {
        visible: true,
      },
      text: '',
    };
    dispatch(addSegmentAfter({segment: newSegment, after: index}))
  };

  return (
    <div ref={ref} className="segments-container">
      {program.segments.map((s, i, ar) => (
        <div key={s.id}>
          <SegmentEditor segment={s} index={i} segmentCount={ar.length} />
          {i < ar.length - 1 && (
            <SegmentDivider
              onAddComputation={() => handleAddComputation(i)}
              onAddText={() => handleAddText(i)}
            />
          )}
        </div>
      ))}
      <div style={{ flex: 1, marginTop: -10 }}>
        {program.segments.length === 0 && (
          <SegmentDivider
            onAddComputation={() => handleAddComputation(-1)}
            onAddText={() => handleAddText(-1)}
          />
        )}
      </div>
    </div>
  );
};
