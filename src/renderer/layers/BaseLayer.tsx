import React, { type FC, type PropsWithChildren } from 'react';

interface BaseLayerProps {
    visible: boolean;
    opacity?: number;
    zIndex?: number;
}

/**
 * Base component for all renderer layers.
 * Handles common visibility and positioning logic.
 */
export const BaseLayer: FC<PropsWithChildren<BaseLayerProps>> = ({
    visible,
    children,
    opacity = 1,
    zIndex = 0
}) => {
    if (!visible) return null;

    return (
        <g
            className="renderer-layer"
            opacity={opacity}
            style={{ zIndex }}
        >
            {children}
        </g>
    );
};
