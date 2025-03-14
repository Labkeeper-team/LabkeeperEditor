import { useSelector } from 'react-redux';
import { SegmentEditor } from './segment';

import './style.scss';
import { useCurrentProgram } from '../../../../../store/selectors/program';
import { useEffect, useRef } from 'react';

export const Segments = () => {
  const program = useSelector(useCurrentProgram);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      (ref.current as any).scrollTo({
        top:100000,
        behavior: "smooth",
      });
    }
  }, [program.segments.length, ref.current])

  return (
    <div ref={ref}  className="segments-container">
      {program.segments.map((s, i, ar) => (
        <SegmentEditor key={s.id} segment={s} index={i} segmentCount={ar.length} />
    ))}
    <div style={{flex: 1, marginTop: -10}}>

    </div>
    </div>
  );
};
