import { useState, useMemo, useCallback } from 'react';
import { calculateDubinsPaths, type Config, type DubinsType, type DubinsPath } from '../../../core/geometry/dubins';

export interface DubinsState {
    startConfig: Config | null;
    endConfig: Config | null;
    rho: number;
    visiblePaths: Set<DubinsType>;
    maxPathsToShow: number; // NEW
    computedPaths: DubinsPath[];
    mode: 'idle' | 'placingStart' | 'placingEnd';
}

export function useDubinsState() {
    const [isActive, setIsActive] = useState(false);
    const [startConfig, setStartConfig] = useState<Config | null>(null);
    const [endConfig, setEndConfig] = useState<Config | null>(null);
    const [rho, setRho] = useState<number>(50);
    const [visiblePaths, setVisiblePaths] = useState<Set<DubinsType>>(new Set(['LSL', 'RSR', 'LSR', 'RSL', 'RLR', 'LRL']));
    const [maxPathsToShow, setMaxPathsToShow] = useState<number>(6); // Default 6 (show all relevant if checked)

    // Mode for interaction
    // We actually might handle mode in the parent or here. Let's keep generic state here.

    const computedPaths = useMemo(() => {
        if (!startConfig || !endConfig) return [];
        return calculateDubinsPaths(startConfig, endConfig, rho);
    }, [startConfig, endConfig, rho]);

    const toggleMode = useCallback(() => {
        setIsActive(prev => !prev);
    }, []);

    const togglePathVisibility = useCallback((type: DubinsType) => {
        setVisiblePaths(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }, []);

    const setAllPathsVisibility = useCallback((visible: boolean) => {
        if (visible) {
            setVisiblePaths(new Set(['LSL', 'RSR', 'LSR', 'RSL', 'RLR', 'LRL']));
        } else {
            setVisiblePaths(new Set());
        }
    }, []);

    return {
        state: {
            isActive,
            startConfig,
            endConfig,
            rho,
            visiblePaths,
            maxPathsToShow,
            computedPaths
        },
        actions: {
            toggleMode,
            setStartConfig,
            setEndConfig,
            setRho,
            setMaxPathsToShow, // NEW
            togglePathVisibility,
            setAllPathsVisibility
        }
    };
}
