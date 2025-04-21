import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { EmptyResultContainer } from './empty';
import { ViewResult } from './view';
import { Button } from '../../../../components/button';
import { SavePdfIcon } from '../../../../shared/icons';
import { InterfaceTourAnchorClassnames } from '../../../../shared/components/tour/helpers';
import {
    useCompiledSuccesInfo,
    useCurrentProject,
    useUser,
} from '../../../../store/selectors/program';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import { setActiveSegmentIndex } from '../../../../store/slices/ide';
import { useDictionary } from '../../../../store/selectors/translations';
import { EVENT_PRINT, onEvent } from '../../../../shared/yandex-metrika';

declare global {
    interface Window {
        MathJax: {
            typesetPromise: (elements: NodeListOf<Element>) => Promise<void>;
        };
    }
}

export const Result = () => {
    const user = useSelector(useUser);
    const dispatch = useDispatch();
    const compileResult = useSelector(useCompiledSuccesInfo);
    const currentProject = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);

    const contentRef = useRef<HTMLDivElement>(null);
    const reactToPrintFn = useReactToPrint({
        contentRef: contentRef,
        documentTitle: currentProject?.title,
    });

    const onPress = () => {
        onEvent(EVENT_PRINT);
        dispatch(setActiveSegmentIndex(-1));
        setTimeout(() => {
            const print = async () => {
                const mathElements =
                    document.querySelectorAll('#compile-result');
                await window.MathJax.typesetPromise(mathElements);
                reactToPrintFn();
            };
            print();
        }, 100);
    };

    return (
        <div className="result-container">
            {!compileResult ? (
                <EmptyResultContainer />
            ) : (
                <ViewResult ref={contentRef} />
            )}
            <Button
                classname={`save-to-pdf-button ${InterfaceTourAnchorClassnames.SavePdf}`}
                title={dictionary.label_save_to_pdf}
                onPress={onPress}
                disabled={!compileResult || !user.isAuthenticated}
                titleIcon={SavePdfIcon}
                color="blue"
                minimize={false}
            />
        </div>
    );
};
