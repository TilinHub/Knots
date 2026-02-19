import React from 'react';

import type { EnvelopeSegment } from '@/core/geometry/contactGraph';
import { ContactPathRenderer } from '@/features/editor/components/ContactPathRenderer';

interface PathLayerProps {
    path: EnvelopeSegment[];
    color: string;
    width?: number;
    opacity?: number;
    visible?: boolean;
}

export const PathLayer: React.FC<PathLayerProps> = ({
    path,
    color,
    width = 3,
    opacity = 1,
    visible = true
}) => {
    if (!visible || !path || path.length === 0) return null;

    // ContactPathRenderer doesn't support opacity prop directly, so we wrap it.
    const content = (
        <ContactPathRenderer
            path={path}
            visible={visible}
            color={color}
            width={width}
        />
    );

    if (opacity < 1) {
        return <g opacity={opacity}>{content}</g>;
    }

    return content;
};
