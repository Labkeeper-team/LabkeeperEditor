import { createRef, memo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';

import {
  useActiveElement,
  useCompiledSegments,
} from '../../../../../store/selectors/program';
import { CodeSegment } from './code-segment';
import { MdSegment } from './md-segment';

export const Segments = memo(() => {
  const segments = useSelector(useCompiledSegments);
  const activeIndex = useSelector(useActiveElement);
  const refs = segments.reduce((prv, seg) => {
    prv[seg.id] = createRef();
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
          case 'computational':
            return (
              <CodeSegment
                ref={refs[segment.id]}
                index={segment.id}
                key={`${segment.id}_${index}_${JSON.stringify(segment.statements)}_${segment?.text}`}
                segment={segment}
              />
            );
          case 'md':
            return (
              <MdSegment
                ref={refs[segment.id]}
                index={segment.id}
                key={`${segment.id}_${index}_${JSON.stringify(segment.statements)}_${segment?.text}`}
                segment={segment}
              />
            );
          default:
            return <div />;
        }
      })}
    </>
  );
});
