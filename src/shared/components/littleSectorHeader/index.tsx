import classNames from 'classnames';
import { ExpandIcon } from '../../icons';
import { SectorHeaderProps } from './model';

import './style.scss';
import { Typography } from '../../../componenets/typography';
import { colors } from '../../styles/colors';

export const SectorHeader = (props: SectorHeaderProps) => {
    return (
        <div
            onClick={props.onPressExpanded}
            className="sector-header-container"
        >
            {typeof props.title === 'string' ? (
                <Typography
                    text={props.title}
                    type="body"
                    color={colors.gray20}
                />
            ) : (
                props.title
            )}
            <div
                className={classNames('expnad-container', {
                    expanded: props.expanded,
                })}
            >
                <ExpandIcon />
            </div>
        </div>
    );
};
