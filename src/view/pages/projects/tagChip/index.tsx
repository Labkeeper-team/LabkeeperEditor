import classNames from 'classnames';
import { MouseEvent } from 'react';

import './style.scss';
import { ProjectTag } from '../../../../model/domain.ts';
import { tagColors } from '../projectsFilter.ts';

/**
 * Метка проекта. С onClick это кнопка (фильтр списка), с onRemove у неё
 * крестик. Щелчок по ней не доходит до строки проекта
 */
export const TagChip = (props: {
    tag: ProjectTag;
    active?: boolean;
    count?: number;
    onClick?: () => void;
    onRemove?: () => void;
    removeLabel?: string;
    small?: boolean;
}) => {
    const { dot, background, border } = tagColors(props.tag.color);
    const stop = (e: MouseEvent) => e.stopPropagation();
    const className = classNames('project-tag', {
        'project-tag--active': props.active,
        'project-tag--small': props.small,
        'project-tag--clickable': !!props.onClick,
    });
    // выбранная метка залита своим цветом, чтобы фильтр было видно сразу
    const style = props.active
        ? { background: dot, borderColor: dot }
        : { background, borderColor: border };
    const content = (
        <>
            <span
                className="project-tag__dot"
                style={{ background: props.active ? undefined : dot }}
            />
            <span className="project-tag__name">{props.tag.name}</span>
            {props.count !== undefined ? (
                <span className="project-tag__count">{props.count}</span>
            ) : null}
        </>
    );

    if (props.onClick) {
        return (
            <button
                type="button"
                className={className}
                style={style}
                aria-pressed={props.active}
                title={props.tag.name}
                onClick={(e) => {
                    stop(e);
                    props.onClick?.();
                }}
                onAuxClick={stop}
            >
                {content}
            </button>
        );
    }

    return (
        <span className={className} style={style} title={props.tag.name}>
            {content}
            {props.onRemove ? (
                <button
                    type="button"
                    className="project-tag__remove"
                    aria-label={`${props.removeLabel ?? ''} ${props.tag.name}`.trim()}
                    onClick={(e) => {
                        stop(e);
                        props.onRemove?.();
                    }}
                >
                    ×
                </button>
            ) : null}
        </span>
    );
};
