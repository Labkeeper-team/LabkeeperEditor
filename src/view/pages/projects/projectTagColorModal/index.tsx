import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../store';
import {
    setNextTagColor,
    setNextTagColorInput,
} from '../../../store/slices/projects';
import {
    useNextTagColor,
    useNextTagColorInput,
} from '../../../store/selectors/program';
import { useDictionary } from '../../../store/selectors/translations';
import {
    DEFAULT_TAG_COLOR,
    normalizeColorInput,
    TAG_COLOR_SWATCHES,
} from '../tagColorUtils';
import './style.scss';

export const ProjectTagColorModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const nextTagColor = useSelector(useNextTagColor);
    const nextTagColorInput = useSelector(useNextTagColorInput);
    const onSwatchClick = (swatchColor: string) => {
        dispatch(setNextTagColor(swatchColor));
        dispatch(setNextTagColorInput(swatchColor));
    };

    const onInputChange = (value: string) => {
        dispatch(setNextTagColorInput(value));
    };

    const onInputCommit = () => {
        const rawValue = nextTagColorInput ?? '';
        const normalized = normalizeColorInput(rawValue);
        if (!normalized) {
            dispatch(setNextTagColorInput(nextTagColor ?? DEFAULT_TAG_COLOR));
            return;
        }
        dispatch(setNextTagColor(normalized));
        dispatch(setNextTagColorInput(normalized));
    };

    return (
        <div
            className="project-tags-color-panel"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="project-tags-color-swatch-grid">
                {TAG_COLOR_SWATCHES.map((swatchColor) => (
                    <button
                        key={`swatch-${swatchColor}`}
                        type="button"
                        className="project-tags-color-swatch"
                        style={{ backgroundColor: swatchColor }}
                        onClick={() => onSwatchClick(swatchColor)}
                        data-selected={
                            (
                                nextTagColor ?? DEFAULT_TAG_COLOR
                            ).toLocaleLowerCase() ===
                            swatchColor.toLocaleLowerCase()
                        }
                        aria-label={`Set tag color ${swatchColor}`}
                    />
                ))}
            </div>
            <input
                className="project-tags-color-input-text"
                value={nextTagColorInput ?? nextTagColor ?? DEFAULT_TAG_COLOR}
                placeholder={dictionary.projects.tags.color_placeholder}
                onChange={(e) => onInputChange(e.target.value)}
                onBlur={onInputCommit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.stopPropagation();
                        onInputCommit();
                    }
                }}
            />
        </div>
    );
};
