import React from 'react';
import { BaseLayer } from './BaseLayer';
import type { LayerProps } from '../types/Layer';
import { DubinsRenderer } from '../../features/editor/components/DubinsRenderer';

interface DubinsLayerProps extends LayerProps {
    dubinsMode: boolean;
    persistentDubinsState: any;
    persistentDubinsActions: any;
    dubinsPaths: any[];
    dubinsStart: any;
    dubinsEnd: any;
    dubinsVisibleTypes: Set<string>;
    plane: 'background' | 'foreground'; // [NEW] Control rendering plane
}

export const DubinsLayer: React.FC<DubinsLayerProps> = ({
    visible,
    dubinsMode,
    persistentDubinsState,
    persistentDubinsActions,
    dubinsPaths,
    dubinsStart,
    dubinsEnd,
    dubinsVisibleTypes,
    plane,
    context
}) => {
    if (!visible || !dubinsMode) return null;

    const { width = 800, height = 600 } = context || {};
    const centerX = width / 2;
    const centerY = height / 2;

    return (
        <BaseLayer visible={visible} zIndex={plane === 'foreground' ? 20 : 5}>
            <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>

                {plane === 'background' && (
                    <>
                        {/* 1. Selected Paths (Behind) */}
                        <DubinsRenderer
                            selectedPaths={persistentDubinsState?.visibleSelectedPaths}
                        />

                        {/* 2. Legacy Support */}
                        <DubinsRenderer
                            paths={dubinsPaths || []}
                            startConfig={dubinsStart || null}
                            endConfig={dubinsEnd || null}
                            visibleTypes={dubinsVisibleTypes || new Set()}
                        />
                    </>
                )}

                {plane === 'foreground' && (
                    /* 3. Interactive Candidates */
                    <DubinsRenderer
                        candidates={persistentDubinsState?.candidates}
                        onPathClick={persistentDubinsActions?.handlePathClick}
                        hoverPathType={persistentDubinsState?.hoverPathType}
                        onPathHover={persistentDubinsActions?.setHoverPathType}
                    />
                )}
            </g>
        </BaseLayer>
    );
};
