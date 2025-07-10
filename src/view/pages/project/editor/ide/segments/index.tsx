import { useDispatch, useSelector } from 'react-redux';
import { SegmentEditor } from './segment';

import './style.scss';
import { useCurrentProgram } from '../../../../../../viewModel/store/selectors/program';
import { useEffect, useRef } from 'react';
import { AppDispatch, StorageState } from '../../../../../../viewModel/store';
import { setScrollEditorToBottom } from '../../../../../../viewModel/store/slices/callback';
import { onSegmentAddedViaDividerRequest } from '../../../../../../controller';
import { SegmentDivider } from './segment-divider';

export const Segments = () => {
    const program = useSelector(useCurrentProgram);
    const scrollEditorToBottom = useSelector(
        (state: StorageState) => state.callback.scrollEditorToBottom
    );
    const ref = useRef<HTMLElement>(null);
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        if (ref?.current && scrollEditorToBottom) {
            ref.current.scrollTo({
                top: 10000000,
                behavior: 'smooth',
            });
            dispatch(setScrollEditorToBottom(false));
        }
    }, [scrollEditorToBottom]);

    return (
        <div ref={ref as any} className="segments-container">
            {program?.segments.map((s, i, ar) => (
                <>
                    <SegmentEditor
                        key={s.id}
                        segment={s}
                        index={i}
                        segmentCount={ar.length}
                    />
                    {i + 1 !== ar.length ? (
                        <div key={`divider-${s.id}`} style={{ flex: 1 }}>
                            <SegmentDivider
                                onAdd={(type) => {
                                    dispatch(
                                        onSegmentAddedViaDividerRequest({
                                            segment: {
                                                id: -1,
                                                type,
                                                parameters: {
                                                    visible: true,
                                                },
                                                text: '',
                                            },
                                            after: i,
                                        })
                                    );
                                }}
                            />
                        </div>
                    ) : (
                        <div key={`empty-space-${s.id}`} style={{ flex: 1}} />
                    )}
                </>
            ))}
        </div>
    );
};
