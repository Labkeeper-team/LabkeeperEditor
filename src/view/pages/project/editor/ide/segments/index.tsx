/* eslint-disable react-hooks/exhaustive-deps */
import { useDispatch, useSelector } from 'react-redux';
import { SegmentEditor } from './segment';

import './style.scss';
import { useCurrentProgram } from '../../../../../../viewModel/store/selectors/program';
import { useEffect, useRef } from 'react';
import { StorageState } from '../../../../../../viewModel/store';
import { setScrollEditorToBottom } from '../../../../../../viewModel/store/slices/callback';

export const Segments = () => {
    const program = useSelector(useCurrentProgram);
    const scrollEditorToBottom = useSelector(
        (state: StorageState) => state.callback.scrollEditorToBottom
    );
    const ref = useRef(null);
    const dispatch = useDispatch();

    useEffect(() => {
        if (ref.current && scrollEditorToBottom) {
            (ref.current as HTMLElement).scrollTo({
                top: 10000000,
                behavior: 'smooth',
            });
            dispatch(setScrollEditorToBottom(false));
        }
    }, [scrollEditorToBottom]);

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
