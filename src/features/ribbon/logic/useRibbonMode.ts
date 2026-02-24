import { useState } from 'react';

export interface RibbonState {
    isActive: boolean;
    width: number;
    showEdges: boolean;
    opacity: number;
}

export function useRibbonMode() {
    const [state, setState] = useState<RibbonState>({
        isActive: false,
        width: 20,
        showEdges: true,
        opacity: 0.3,
    });

    const toggleMode = () => setState(prev => ({ ...prev, isActive: !prev.isActive }));
    const setWidth = (width: number) => setState(prev => ({ ...prev, width }));
    const setOpacity = (opacity: number) => setState(prev => ({ ...prev, opacity }));
    const toggleEdges = () => setState(prev => ({ ...prev, showEdges: !prev.showEdges }));

    return {
        state,
        actions: {
            toggleMode,
            setWidth,
            setOpacity,
            toggleEdges,
        },
    };
}
