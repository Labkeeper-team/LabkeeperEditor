import { useDispatch, useSelector } from 'react-redux';
import {
    useCurrentProgram,
    useIsProjectReadonly,
} from '../../../../../../store/selectors/program';
import { useDictionary } from '../../../../../../store/selectors/translations.ts';
import { AppDispatch, StorageState } from '../../../../../../store';
import { controller } from '../../../../../../../main.tsx';
import { SegmentDivider } from '../segment-divider';
import { latexHeaderDisplayFor, latexHeaderFor } from './latexHeader.ts';
import './style.scss';

const LATEX_FOOTER_TEXT = String.raw`\end{document}`;

interface LatexBoundaryCardBaseProps {
    containerClassName: 'latex-header-segment' | 'latex-footer-segment';
    title: string;
    hint?: string;
    content: string;
    onClick?: () => void;
}

const LatexBoundaryCardBase = ({
    containerClassName,
    title,
    hint,
    content,
    onClick,
}: LatexBoundaryCardBaseProps) => {
    return (
        <div
            className={`${containerClassName}${onClick ? ' latex-boundary-card--interactive' : ''}`}
            onClick={onClick}
        >
            <div className="latex-boundary-meta">
                {hint && <span className="latex-boundary-hint">{hint}</span>}
                <span className="latex-boundary-badge">{title}</span>
            </div>
            <pre className="latex-boundary-content">{content}</pre>
        </div>
    );
};

export const LatexHeaderBoundaryCard = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const program = useSelector(useCurrentProgram);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const segments = program?.segments ?? [];

    const shouldShow =
        isLatexMode &&
        !segments.some((segment) => segment.text.includes('\\begin{document}'));

    if (!shouldShow) {
        return null;
    }

    // the header must match the engine, otherwise it switches off the server's XeLaTeX auto-preamble
    const compiler = program?.parameters.latexCompiler;
    const headerText = latexHeaderFor(compiler);

    return (
        <LatexBoundaryCardBase
            containerClassName="latex-header-segment"
            title={dictionary.latex_boundary.header}
            hint={
                isReadonly ? undefined : dictionary.latex_boundary.insert_hint
            }
            content={isReadonly ? headerText : latexHeaderDisplayFor(compiler)}
            onClick={
                isReadonly
                    ? undefined
                    : () =>
                          dispatch(
                              controller.onAddLatexBoundarySegmentRequest({
                                  text: headerText,
                                  placement: 'start',
                              })
                          )
            }
        />
    );
};

export const LatexFooterBoundaryCard = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const program = useSelector(useCurrentProgram);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const segments = program?.segments ?? [];

    const shouldShow =
        isLatexMode &&
        !segments.some((segment) => segment.text.includes('\\end{document}'));

    if (!shouldShow) {
        return null;
    }

    return (
        <>
            <SegmentDivider index={segments.length - 1} showDivider />
            <LatexBoundaryCardBase
                containerClassName="latex-footer-segment"
                title={dictionary.latex_boundary.footer}
                hint={
                    isReadonly
                        ? undefined
                        : dictionary.latex_boundary.insert_hint
                }
                content={LATEX_FOOTER_TEXT}
                onClick={
                    isReadonly
                        ? undefined
                        : () =>
                              dispatch(
                                  controller.onAddLatexBoundarySegmentRequest({
                                      text: LATEX_FOOTER_TEXT,
                                      placement: 'end',
                                  })
                              )
                }
            />
        </>
    );
};
