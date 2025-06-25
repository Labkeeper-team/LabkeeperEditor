import { createRef, memo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';

import {
    useActiveElement,
    useCompiledSegments,
} from '../../../../../../viewModel/store/selectors/program';
import { CodeSegment } from './code-segment';
import { MdSegment } from './md-segment';
import {
    ComputationalOutputSegment,
    TextOutputSegment,
} from '../../../../../../model/domain.ts';
import { LatexSegment } from './latex-segment.tsx';
import { AsciimathSegment } from './asciimath-segment.tsx';

export const Segments = memo(() => {
    const segments = useSelector(useCompiledSegments);
    const activeIndex = useSelector(useActiveElement);
    const refs = (segments || []).reduce((prv, _, index) => {
        prv[index] = createRef();
        return prv;
    }, {});

    const handleClick = useCallback(
        (index) =>
            refs[index]?.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            }),
        [refs]
    );

    useEffect(() => {
        if (activeIndex > -1) {
            handleClick(activeIndex);
        }
    }, [activeIndex, refs, handleClick]);

    return (
        <>
            {segments?.map((segment, index) => {
                switch (segment.type) {
                    case 'computational': {
                        const comp = segment as ComputationalOutputSegment;
                        return (
                            <CodeSegment
                                ref={refs[index]}
                                index={index}
                                key={`${segment.id}_${index}_${JSON.stringify(comp.statements)}`}
                                segment={comp}
                            />
                        );
                    }
                    case 'md': {
                        const text = segment as TextOutputSegment;
                        return (
                            <MdSegment
                                ref={refs[index]}
                                key={`${segment.id}_${index}_${text.text}`}
                                segment={text}
                                index={index}
                            />
                        );
                    }
                    case 'latex': {
                        const text = segment as TextOutputSegment;
                        return (
                            <LatexSegment
                                ref={refs[index]}
                                key={`${segment.id}_${index}_${text.text}`}
                                segment={text}
                                index={index}
                            />
                        );
                    }
                    case 'asciimath': {
                        const text = segment as TextOutputSegment;
                        return (
                            <AsciimathSegment
                                ref={refs[index]}
                                key={`${segment.id}_${index}_${text.text}`}
                                segment={text}
                                index={index}
                            />
                        );
                    }
                    default:
                        return <div />;
                }
            })}
        </>
    );
});
