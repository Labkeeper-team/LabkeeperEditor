import { useState } from 'react';

export const FileSegment = ({ url }: { url: string }) => {
    const [cacheBuster] = useState(() => String(Date.now()));

    return (
        <div>
            <img
                src={`${url}?t=${cacheBuster}`}
                alt="generated-image"
                width="500px"
                style={{
                    display: 'block',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                }}
            />
        </div>
    );
};
