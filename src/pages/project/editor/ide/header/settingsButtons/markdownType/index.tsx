import { useDispatch, useSelector } from 'react-redux';
import { useActiveSegment } from '../../../../../../../store/selectors/program';
import { changeSegmentTextById } from '../../../../../../../store/slices/project';

import './style.scss';
import { StorageState } from '../../../../../../../store';

const types = {
    h1: '# H1',
    h2: '## H2',
    h3: '### H3',
    h4: '#### H4',
    h5: '##### H5',
    h6: '###### H6',
};

export const MarkdownTypes = () => {
    const prevActiveIndex = useSelector(
        (state: StorageState) => state.ide.previousActiveSegmentIndex
    );
    const activeSegment = useSelector(
        useActiveSegment(prevActiveIndex >= 0 ? prevActiveIndex : 0)
    );
    const dispatch = useDispatch();
    const onClick = (type: string) => {
        if (prevActiveIndex === -1 || prevActiveIndex === undefined) {
            return;
        }

        const newActiveSegment = { ...activeSegment };
        const text = `${newActiveSegment.text}\n${types[type] || types.h1}`;
        dispatch(changeSegmentTextById({ id: prevActiveIndex, text }));
    };

    return (
        <div className="markdown-select-dropdown">
            <span onClick={() => onClick('h1')}># H1</span>
            <span onClick={() => onClick('h2')}>## H2</span>
            <span onClick={() => onClick('h3')}>### H3</span>
            <span onClick={() => onClick('h4')}>#### H4</span>
            <span onClick={() => onClick('h5')}>##### H5</span>
            <span onClick={() => onClick('h6')}>###### H6</span>
        </div>
    );
};
