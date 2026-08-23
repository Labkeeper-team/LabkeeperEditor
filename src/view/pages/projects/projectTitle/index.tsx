import { useRef, useState } from 'react';
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

export const ProjectTitle = (props: { project: ProjectShort }) => {
    const ref = useRef<HTMLInputElement>(null);
    const [editMode, setEditMode] = useState(false);
    const [currentTitle, setCurrentTitle] = useState(props.project.title);
    const dispatch = useDispatch<AppDispatch>();

    const onClickChange = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        setEditMode(true);
        setTimeout(() => {
            ref.current?.focus();
        }, 100);
    };

    /*
    Когда заканчивает ввод названия
     */
    const onInputBlur = async () => {
        if (!props.project.projectId) {
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
        setEditMode(false);
    };

    useHotkeys(
        'esc',
        () => {
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
                    <Typography
                        className="project-title-text"
                        color={colors.gray10}
                        text={currentTitle}
                        type="body-large"
                    />
                    <div
                        onClick={onClickChange}
                        className="change-icon-container"
                    >
                        <PencilIcon />
                    </div>
                </>
            )}
        </div>
    );
};
