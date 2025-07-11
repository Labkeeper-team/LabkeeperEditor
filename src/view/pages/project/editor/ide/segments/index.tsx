import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SegmentEditor } from './segment';

import './style.scss';
import { useCurrentProgram } from '../../../../../../viewModel/store/selectors/program';
import { useEffect, useRef } from 'react';
import { AppDispatch, StorageState } from '../../../../../../viewModel/store';
import { setScrollEditorToBottom } from '../../../../../../viewModel/store/slices/callback';
import { SegmentDivider } from './segment-divider';

export const Segments = () => {
    const program = useSelector(useCurrentProgram);
    const scrollEditorToBottom = useSelector(
        (state: StorageState) => state.callback.scrollEditorToBottom
    );
    const ref = useRef<HTMLDivElement>(null);
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        if (ref?.current && scrollEditorToBottom) {
            ref.current.scrollTo({
                top: 10000000,
                behavior: 'smooth',
            });
            dispatch(setScrollEditorToBottom(false));
        }
    }, [scrollEditorToBottom, dispatch]);

    return (
        <div ref={ref} className="segments-container">
            {program?.segments.map((s, i, ar) => {
                return (
                    <React.Fragment key={s.id}>
                        <SegmentEditor
                            segment={s}
                            index={i}
                            segmentCount={ar.length}
                        />
                        <SegmentDivider
                            index={i}
                            showDivider={i + 1 !== ar.length}
                        />
                    </React.Fragment>
                );
            })}
        </div>
    );
};
