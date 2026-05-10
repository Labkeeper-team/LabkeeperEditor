import { useDispatch, useSelector } from 'react-redux';
import { useCurrentProgram } from '../../../../../../store/selectors/program';
import { useDictionary } from '../../../../../../store/selectors/translations.ts';
import { AppDispatch, StorageState } from '../../../../../../store';
import { controller } from '../../../../../../../main.tsx';
import './style.scss';

const LATEX_HEADER_TEXT = String.raw`\documentclass[a4paper,12pt]{article}
\usepackage{comment,cmap,amsmath,longtable,mathtools}
\usepackage{booktabs,geometry,graphicx,listings,hyperref}
\usepackage[T2A]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[english,russian]{babel}
\geometry{
  a4paper,
  top=3mm,
  right=5mm,
  bottom=3mm,
  left=5mm
}
\setcounter{secnumdepth}{0}
\mathtoolsset{showonlyrefs}
\newcounter{none}
\begin{document}
\null`;

const LATEX_FOOTER_TEXT = String.raw`\end{document}`;

interface LatexBoundaryCardBaseProps {
    containerClassName: 'latex-header-segment' | 'latex-footer-segment';
    title: string;
    hint: string;
    content: string;
    onClick: () => void;
}

const LatexBoundaryCardBase = ({
    containerClassName,
    title,
    hint,
    content,
    onClick,
}: LatexBoundaryCardBaseProps) => {
    return (
        <div className={containerClassName} onClick={onClick}>
            <div className="latex-boundary-meta">
                <span className="latex-boundary-badge">{title}</span>
                <span className="latex-boundary-hint">{hint}</span>
            </div>
            <pre className="latex-boundary-content">{content}</pre>
        </div>
    );
};

export const LatexHeaderBoundaryCard = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const program = useSelector(useCurrentProgram);
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

    return (
        <LatexBoundaryCardBase
            containerClassName="latex-header-segment"
            title={dictionary.latex_boundary.header}
            hint={dictionary.latex_boundary.insert_hint}
            content={LATEX_HEADER_TEXT}
            onClick={() =>
                dispatch(
                    controller.onAddLatexBoundarySegmentRequest({
                        text: LATEX_HEADER_TEXT,
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
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const segments = program?.segments ?? [];

    const shouldShow =
        isLatexMode &&
        !segments.some((segment) => segment.text.trim() === '\\end{document}');

    if (!shouldShow) {
        return null;
    }

    return (
        <LatexBoundaryCardBase
            containerClassName="latex-footer-segment"
            title={dictionary.latex_boundary.footer}
            hint={dictionary.latex_boundary.insert_hint}
            content={LATEX_FOOTER_TEXT}
            onClick={() =>
                dispatch(
                    controller.onAddLatexBoundarySegmentRequest({
                        text: LATEX_FOOTER_TEXT,
                        placement: 'end',
                    })
                )
            }
        />
    );
};
