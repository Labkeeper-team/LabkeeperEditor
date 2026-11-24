import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import {
    useCompiledErrors,
    useIsProjectReadonly,
} from '../../../../store/selectors/program';
import { useDictionary } from '../../../../store/selectors/translations';
import { requiresXelatex } from '../../../../../viewModel/utils/compileErrors.ts';
import { controller } from '../../../../../main.tsx';

/**
 * GH-278: сборка pdfLaTeX упала на пакете, которому нужен XeTeX (fontspec,
 * polyglossia, unicode-math). Полоса видна и при свёрнутой панели: иначе
 * человек видит только фатальную ошибку пакета и не знает, что делать
 */
export const XelatexHint = () => {
    const dispatch = useDispatch<AppDispatch>();
    const texts = useSelector(useDictionary).latex_compiler;
    const errors = useSelector(useCompiledErrors);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isLatex = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const isXelatex = useSelector(
        (state: StorageState) =>
            state.project.currentProgram?.parameters.latexCompiler === 'xelatex'
    );
    const isCompiling = useSelector(
        (state: StorageState) => state.settings.isCompiling
    );

    // движок чужого проекта не сменить, а XeLaTeX уже выбран: подсказывать нечего
    if (isReadonly || !isLatex || isXelatex || !requiresXelatex(errors)) {
        return null;
    }

    return (
        <div className="problem-viewer-xelatex" role="status">
            <span className="problem-viewer-xelatex__text">
                {texts.requires_xelatex}
            </span>
            <button
                type="button"
                className="problem-viewer-xelatex__switch"
                disabled={isCompiling}
                onClick={() => dispatch(controller.onSwitchToXelatexRequest())}
            >
                {texts.switch_to_xelatex}
            </button>
        </div>
    );
};
