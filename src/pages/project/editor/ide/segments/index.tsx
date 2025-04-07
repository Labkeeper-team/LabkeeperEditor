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
            (ref.current as HTMLElement).scrollTo({
                top: 100000,
                behavior: 'smooth',
            });
        }
    }, [program?.segments?.length, ref.current]);

    return (
        <div ref={ref} className="segments-container">
            {program?.segments.map((s, i, ar) => (
                <div key={s.id}>
                    <SegmentEditor
                        segment={s}
                        index={i}
                        segmentCount={ar.length}
                    />
                </div>
            ))}
        </div>
    );
};
