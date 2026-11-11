import { useEffect, useRef, useState } from 'react';
import { PencilIcon } from '../../../icons';

import './style.scss';
import { Input } from '../../../components/input';
import { Typography } from '../../../components/typography';
import { colors } from '../../../styles/colors.ts';

import { useHotkeys } from 'react-hotkeys-hook';
import { useDispatch } from 'react-redux';
import {
    PROJECT_TITLE_MAX_LENGTH,
    ProjectShort,
} from '../../../../model/domain.ts';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../main.tsx';

export const ProjectTitle = (props: {
    project: ProjectShort;
    /** GH-208: адрес проекта, чтобы его можно было открыть в новой вкладке */
    href: string;
    /** GH-207: подсказка с полным названием, если оно не влезло */
    tooltipId?: string;
    /** Переименование, начатое снаружи, например из меню проекта */
    editing?: boolean;
    onEditingChange?: (editing: boolean) => void;
}) => {
    const ref = useRef<HTMLInputElement>(null);
    const [ownEditMode, setOwnEditMode] = useState(false);
    const editMode = props.editing ?? ownEditMode;
    const setEditMode = (value: boolean) => {
        setOwnEditMode(value);
        props.onEditingChange?.(value);
    };
    const [currentTitle, setCurrentTitle] = useState(props.project.title);
    const dispatch = useDispatch<AppDispatch>();

    // список пришёл заново: название могли сменить в редакторе или другой вкладке
    const [syncedTitle, setSyncedTitle] = useState(props.project.title);
    if (syncedTitle !== props.project.title) {
        setSyncedTitle(props.project.title);
        if (!editMode) {
            setCurrentTitle(props.project.title);
        }
    }

    useEffect(() => {
        if (editMode) {
            const timer = setTimeout(() => {
                const input = ref.current;
                input?.focus();
                // выделяем, только пока ничего не напечатали поверх
                if (input && input.value === props.project.title) {
                    input.select();
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [editMode, props.project.title]);

    const onClickChange = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        setEditMode(true);
    };

    /*
    Когда заканчивает ввод названия
     */
    const onInputBlur = async () => {
        if (!props.project.projectId || !editMode) {
            return;
        }
        setEditMode(false);
        // пробелы по краям сервер не хранит: без них название могло не измениться
        if (currentTitle.trim() === props.project.title) {
            setCurrentTitle(props.project.title);
            return;
        }
        dispatch(
            controller.onProjectTitleChangedRequest({
                projectId: props.project.projectId,
                title: currentTitle,
                okCallback: () => {},
                failCallback: () => setCurrentTitle(props.project.title),
            })
        );
    };

    useHotkeys(
        'esc',
        () => {
            if (!editMode) {
                return;
            }
            setCurrentTitle(props.project.title);
            setEditMode(false);
        },
        { enableOnFormTags: true }
    );

    return (
        <div className="project-title-container">
            {editMode ? (
                <Input
                    ref={ref}
                    value={currentTitle}
                    onBlur={onInputBlur}
                    onKeyDown={(e) =>
                        e.key === 'Enter' ? onInputBlur() : () => {}
                    }
                    onChange={(e) => setCurrentTitle(e.target.value)}
                    showCharacterCount
                    maxLength={PROJECT_TITLE_MAX_LENGTH}
                />
            ) : (
                <>
                    <a className="project-title-link" href={props.href}>
                        <Typography
                            className="project-title-text"
                            color={colors.gray10}
                            data-tooltip-content={currentTitle}
                            data-tooltip-id={props.tooltipId}
                            text={currentTitle}
                            type="body-large"
                        />
                    </a>
                    <div
                        onClick={onClickChange}
                        // средняя кнопка по карандашу не открывает проект в новой вкладке
                        onAuxClick={(e) => e.stopPropagation()}
                        className="change-icon-container"
                    >
                        <PencilIcon />
                    </div>
                </>
            )}
        </div>
    );
};
