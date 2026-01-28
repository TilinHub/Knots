import { useState, useMemo, useCallback } from 'react';
import { calculateDubinsPaths, type Config, type DubinsType, type DubinsPath } from '../../../core/geometry/dubins';
import { type ContactDisk } from '../../../core/types/contactGraph';

export interface DubinsState {
    startConfig: Config | null;
    endConfig: Config | null;
    rho: number;
    visiblePaths: Set<DubinsType>;
    maxPathsToShow: number; // NEW
    computedPaths: DubinsPath[];
    mode: 'idle' | 'placingStart' | 'placingEnd';
}

export function useDubinsState(disks: ContactDisk[] = []) {
    const [isActive, setIsActive] = useState(false);
    const [startConfig, setStartConfig] = useState<Config | null>(null);
    const [endConfig, setEndConfig] = useState<Config | null>(null);
    const [rho, setRho] = useState<number>(50);
    const [visiblePaths, setVisiblePaths] = useState<Set<DubinsType>>(new Set(['LSL', 'RSR', 'LSR', 'RSL', 'RLR', 'LRL']));
    const [maxPathsToShow, setMaxPathsToShow] = useState<number>(6);

    // Disk Selection State
    const [startDiskId, setStartDiskId] = useState<string | null>(null);
    const [endDiskId, setEndDiskId] = useState<string | null>(null);

    // Helper: Calculate Tangent Paths
    const calculateTangentPaths = useCallback((sDisk: ContactDisk, eDisk: ContactDisk): DubinsPath[] => {
        const paths: DubinsPath[] = [];
        const dx = eDisk.center.x - sDisk.center.x;
        const dy = eDisk.center.y - sDisk.center.y;
        const D = Math.sqrt(dx * dx + dy * dy);
        const phi = Math.atan2(dy, dx);

        // Use max radius to ensure path clears both disks (no cutting inside)
        const R = Math.max(sDisk.radius, eDisk.radius);

        // 1. LSL (Top Tangent)
        // Tangent points should be at phi - pi/2 (Top relative to Right heading)
        // Solver L (+Theta/CW) curves "Down/Right". 
        // At Top Point, Heading Right -> Tangent. Curve matches Disk curvature approx.
        const pLSL_start = {
            x: sDisk.center.x + sDisk.radius * Math.cos(phi - Math.PI / 2),
            y: sDisk.center.y + sDisk.radius * Math.sin(phi - Math.PI / 2),
            theta: phi
        };
        const pLSL_end = {
            x: eDisk.center.x + eDisk.radius * Math.cos(phi - Math.PI / 2),
            y: eDisk.center.y + eDisk.radius * Math.sin(phi - Math.PI / 2),
            theta: phi
        };
        const resLSL = calculateDubinsPaths(pLSL_start, pLSL_end, R).find(p => p.type === 'LSL');
        if (resLSL) paths.push(resLSL);

        // 2. RSR (Bottom Tangent)
        const pRSR_start = {
            x: sDisk.center.x + sDisk.radius * Math.cos(phi + Math.PI / 2),
            y: sDisk.center.y + sDisk.radius * Math.sin(phi + Math.PI / 2),
            theta: phi
        };
        const pRSR_end = {
            x: eDisk.center.x + eDisk.radius * Math.cos(phi + Math.PI / 2),
            y: eDisk.center.y + eDisk.radius * Math.sin(phi + Math.PI / 2),
            theta: phi
        };
        const resRSR = calculateDubinsPaths(pRSR_start, pRSR_end, R).find(p => p.type === 'RSR');
        if (resRSR) paths.push(resRSR);

        // 3. Inner Tangents (LSR, RSL)
        const beta = Math.asin((sDisk.radius + eDisk.radius) / D); // Approximate for crossing
        // Actually, internal tangents angle delta = asin((R1+R2)/D).
        // If sDisk and eDisk have diff radii, we should use that. 
        // But for visual robustness if disks separated:
        if (!isNaN(beta)) {
            // LSR
            const thLSR = phi + beta;
            // Start (L): Top-Left relative to new heading? No, Tangent is rotated 'beta' from phi.
            // Point on disk is perpendicular to tangent.
            // L Turn -> Normal is -90 deg.
            const pLSR_start = {
                x: sDisk.center.x + sDisk.radius * Math.cos(thLSR - Math.PI / 2),
                y: sDisk.center.y + sDisk.radius * Math.sin(thLSR - Math.PI / 2),
                theta: thLSR
            };
            const pLSR_end = {
                x: eDisk.center.x + eDisk.radius * Math.cos(thLSR + Math.PI / 2), // R Turn -> Normal +90
                y: eDisk.center.y + eDisk.radius * Math.sin(thLSR + Math.PI / 2),
                theta: thLSR
            };
            const resLSR = calculateDubinsPaths(pLSR_start, pLSR_end, R).find(p => p.type === 'LSR');
            if (resLSR) paths.push(resLSR);

            // RSL
            const thRSL = phi - beta;
            const pRSL_start = {
                x: sDisk.center.x + sDisk.radius * Math.cos(thRSL + Math.PI / 2),
                y: sDisk.center.y + sDisk.radius * Math.sin(thRSL + Math.PI / 2),
                theta: thRSL
            };
            const pRSL_end = {
                x: eDisk.center.x + eDisk.radius * Math.cos(thRSL - Math.PI / 2),
                y: eDisk.center.y + eDisk.radius * Math.sin(thRSL - Math.PI / 2),
                theta: thRSL
            };
            const resRSL = calculateDubinsPaths(pRSL_start, pRSL_end, R).find(p => p.type === 'RSL');
            if (resRSL) paths.push(resRSL);
        }

        return paths;
    }, []);

    const toggleMode = useCallback(() => {
        setIsActive(prev => {
            if (prev) {
                setStartDiskId(null);
                setEndDiskId(null);
                setStartConfig(null);
                setEndConfig(null);
                return false;
            }
            return true;
        });
    }, []);

    const handleDiskSelect = useCallback((disk: ContactDisk) => {
        if (!startDiskId) {
            setStartDiskId(disk.id);
            if (endDiskId === disk.id) setEndDiskId(null);
        } else if (startDiskId === disk.id) {
            setStartDiskId(null);
            setStartConfig(null);
            setEndConfig(null);
            setEndDiskId(null);
        } else {
            setEndDiskId(disk.id);
        }
    }, [startDiskId, endDiskId]);

    const computedPaths = useMemo(() => {
        if (startDiskId && endDiskId) {
            const sDisk = disks.find(d => d.id === startDiskId);
            const eDisk = disks.find(d => d.id === endDiskId);
            if (sDisk && eDisk) {
                return calculateTangentPaths(sDisk, eDisk);
            }
        }
        if (!startConfig || !endConfig) return [];
        return calculateDubinsPaths(startConfig, endConfig, rho);
    }, [startConfig, endConfig, rho, startDiskId, endDiskId, disks, calculateTangentPaths]);

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
            computedPaths,
            startDiskId, // NEW
            endDiskId    // NEW
        },
        actions: {
            toggleMode,
            setStartConfig,
            setEndConfig,
            setRho,
            setMaxPathsToShow,
            togglePathVisibility,
            setAllPathsVisibility,
            handleDiskSelect // NEW
        }
    };
}
