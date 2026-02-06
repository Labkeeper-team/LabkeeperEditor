import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { EmptyResultContainer } from './empty';
import { ViewResult } from './view';
import { PdfResultViewer } from './pdf';
import { Button } from '../../../../components/button';
import { SavePdfIcon } from '../../../../icons';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';
import {
    useCompiledSuccesInfo,
    useCurrentFullProject,
    useUser,
} from '../../../../store/selectors/program';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import { useDictionary } from '../../../../store/selectors/translations';
import { AppDispatch } from '../../../../store';
import { controller } from '../../../../../main.tsx';
import { ProjectMode } from '../../../../../model/domain.ts';

declare global {
    interface Window {
        MathJax: {
            typesetPromise: (elements: NodeListOf<Element>) => Promise<void>;
        };
    }
}

export const Result = ({ mode = 'markdown' }: { mode?: ProjectMode }) => {
    const user = useSelector(useUser);
    const dispatch = useDispatch<AppDispatch>();
    const compileResult = useSelector(useCompiledSuccesInfo);
    const { project: currentProject, pdfUri } = useSelector(
        useCurrentFullProject
    );

    const dictionary = useSelector(useDictionary);

    const contentRef = useRef<HTMLDivElement>(null);
    const reactToPrintFn = useReactToPrint({
        contentRef: contentRef,
        documentTitle: currentProject?.title,
    });

    const onPress = () => {
        if (mode === 'latex') {
            if (!pdfUri) {
                return;
            }
            fetch(pdfUri)
                .then((res) => res.blob())
                .then((blob) => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `result.pdf`;
                    a.click();
                });
            return;
        }
        dispatch(controller.onPrintButtonPressedRequest());
        if (mode === 'latex' && pdfUri) {
            window.open(pdfUri);
            return;
        }
        const isMobile =
            /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
                navigator.userAgent
            );

        if (isMobile) {
            setTimeout(async () => {
                const mathElements =
                    document.querySelectorAll('#compile-result');
                await window.MathJax.typesetPromise(mathElements);

                const content = contentRef.current;
                if (!content) return;

                const newWindow = window.open(
                    '',
                    '_blank',
                    'width=800,height=600'
                );
                if (!newWindow) return;
                const collectStyles = () => {
                    const links = Array.from(
                        document.querySelectorAll('link[rel="stylesheet"]')
                    );
                    const styles = Array.from(
                        document.querySelectorAll('style')
                    );

                    const linkTags = links
                        .map(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (link: any) =>
                                `<link rel="stylesheet" href="${link.href}" />`
                        )
                        .join('\n');

                    const styleTags = styles
                        .map((style) => `<style>${style.innerHTML}</style>`)
                        .join('\n');

                    return linkTags + styleTags;
                };

                const html = `
                <html>
                  <head>
                    <meta charset="UTF-8">
                    <title>${currentProject?.title ?? 'Document'}</title>
                    ${collectStyles()}
                  </head>
                  <body>
                    ${content.innerHTML}
                  </body>
                </html>
              `;

                newWindow.document.open();
                newWindow.document.write(html);
                newWindow.document.close();

                newWindow.focus();
                newWindow.print();
            }, 100);
            return;
        }

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
            {mode === 'latex' && <PdfResultViewer />}
            {mode !== 'latex' && compileResult?.segments?.length ? (
                <ViewResult ref={contentRef} />
            ) : null}
            {mode !== 'latex' && !compileResult?.segments?.length ? (
                <EmptyResultContainer />
            ) : null}
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
