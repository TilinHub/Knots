import { useState } from 'react';

export interface RibbonState {
    isActive: boolean;
    width: number;
    showCenterPath: boolean;
    opacity: number;
}

export function useRibbonMode() {
    const [state, setState] = useState<RibbonState>({
        isActive: false,
        width: 100, // Fixed default width to match paper
        showCenterPath: true, // Center path visible by default
        opacity: 1, // Solid by default to match paper
    });

    const toggleMode = () => setState(prev => ({ ...prev, isActive: !prev.isActive }));
    const setWidth = (width: number) => setState(prev => ({ ...prev, width }));
    const setOpacity = (opacity: number) => setState(prev => ({ ...prev, opacity }));
    const toggleCenterPath = () => setState(prev => ({ ...prev, showCenterPath: !prev.showCenterPath }));

    return {
        state,
        actions: {
            toggleMode,
            setWidth,
            setOpacity,
            toggleCenterPath,
        },
    };
}
