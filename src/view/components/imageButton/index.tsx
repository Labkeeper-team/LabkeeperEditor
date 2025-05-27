import classNames from 'classnames';
import { ImageButtonProps } from './model';
import { RightArrowIcon } from '../../icons';

import './style.scss';

export const ImageButton = (props: ImageButtonProps) => {
    return (
        <button
            onClick={props.onClick}
            className={classNames('image-button', {
                primary: props.type === 'primary',
                outline: props.type === 'outline',
                rotate: props.rotate,
            })}
        >
            <RightArrowIcon />
        </button>
    );
};
