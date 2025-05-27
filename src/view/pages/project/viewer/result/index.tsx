import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { EmptyResultContainer } from './empty';
import { ViewResult } from './view';
import { Button } from '../../../../components/button';
import { SavePdfIcon } from '../../../../icons';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';
import {
    useCompiledSuccesInfo,
    useCurrentProject,
    useUser,
} from '../../../../../viewModel/store/selectors/program';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import { useDictionary } from '../../../../../viewModel/store/selectors/translations';
import { AppDispatch } from '../../../../../viewModel/store';
import { onPrintButtonPressedRequest } from '../../../../../controller';
import { observerService } from '../../../../../main.tsx';
import { Events } from '../../../../../model/service/observer.ts';

declare global {
    interface Window {
        MathJax: {
            typesetPromise: (elements: NodeListOf<Element>) => Promise<void>;
        };
    }
}

export const Result = () => {
    const user = useSelector(useUser);
    const dispatch = useDispatch<AppDispatch>();
    const compileResult = useSelector(useCompiledSuccesInfo);
    const currentProject = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);

    const contentRef = useRef<HTMLDivElement>(null);
    const reactToPrintFn = useReactToPrint({
        contentRef: contentRef,
        documentTitle: currentProject?.title,
    });

    const onPress = () => {
        observerService.onEvent(Events.EVENT_PRINT);
        dispatch(onPrintButtonPressedRequest());
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
            {compileResult === undefined ||
            compileResult.segments === undefined ||
            compileResult.segments.length === 0 ? (
                <EmptyResultContainer />
            ) : (
                <ViewResult ref={contentRef} />
            )}
            <Button
                classname={`save-to-pdf-button ${InterfaceTourAnchorClassnames.SavePdf}`}
                title={dictionary.label_save_to_pdf}
                onPress={onPress}
                disabled={
                    compileResult === undefined ||
                    compileResult.segments === undefined ||
                    compileResult.segments.length === 0 ||
                    !user.isAuthenticated
                }
                titleIcon={() => <SavePdfIcon />}
                color="blue"
                minimize={false}
            />
        </div>
    );
};
