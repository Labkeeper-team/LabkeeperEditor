import { DEFAULT_TAG_COLOR } from '../tagColorUtils';
import './style.scss';

type TagChipProps = {
    label: string;
    color?: string;
    className?: string;
    title?: string;
};

export const TagChip = ({
    label,
    color = DEFAULT_TAG_COLOR,
    className = 'tag-chip',
    title = label,
}: TagChipProps) => (
    <span className={className} title={title}>
        <span className="tag-color-dot" style={{ backgroundColor: color }} />
        <span className="tag-label">{label}</span>
    </span>
);
