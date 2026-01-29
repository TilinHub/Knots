import { useState, useEffect, useCallback, useRef } from 'react';
import type { CSBlock, CSDisk } from '../../../core/types/cs';

interface UseRollingModeProps {
    blocks: CSBlock[];
}

interface RollingState {
    isActive: boolean;
    pivotDiskId: string | null;
    rollingDiskId: string | null;
    theta: number;
    speed: number;
    isAnimating: boolean;
    showTrail: boolean;
}

export function useRollingMode({ blocks }: UseRollingModeProps) {
    // State
    const [state, setState] = useState<RollingState>({
        isActive: false,
        pivotDiskId: null,
        rollingDiskId: null,
        theta: 0,
        speed: 0.02,
        isAnimating: false,
        showTrail: true,
    });

    const requestRef = useRef<number | undefined>(undefined);
    const diskBlocks = blocks.filter((b): b is CSDisk => b.kind === 'disk');

    // Collision Logic (Pure function within hook scope)
    const checkCollision = useCallback((currentTheta: number, pivotId: string, rollingId: string) => {
        const pivot = diskBlocks.find(d => d.id === pivotId);
        const rolling = diskBlocks.find(d => d.id === rollingId);

        if (!pivot || !rolling) return false;

        // Use VISUAL radius for collision to match what users see
        const distance = pivot.visualRadius + rolling.visualRadius;
        const newCenter = {
            x: pivot.center.x + distance * Math.cos(currentTheta),
            y: pivot.center.y + distance * Math.sin(currentTheta),
        };

        for (const other of diskBlocks) {
            if (other.id === pivotId || other.id === rollingId) continue;

            const dx = newCenter.x - other.center.x;
            const dy = newCenter.y - other.center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Collision if distance < sum of visual radii
            if (dist < rolling.visualRadius + other.visualRadius - 0.1) {
                return true;
            }
        }
        return false;
    }, [diskBlocks]);

    // Animation Loop using requestAnimationFrame
    const animate = useCallback(() => {
        setState(prev => {
            if (!prev.isAnimating || !prev.pivotDiskId || !prev.rollingDiskId) return prev;

            const newTheta = prev.theta + prev.speed;

            if (checkCollision(newTheta, prev.pivotDiskId, prev.rollingDiskId)) {
                return { ...prev, isAnimating: false };
            }

            return { ...prev, theta: newTheta };
        });

        requestRef.current = requestAnimationFrame(animate);
    }, [checkCollision]);

    useEffect(() => {
        if (state.isAnimating) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [state.isAnimating, animate]);

    // Actions
    const toggleMode = () => setState(prev => ({
        ...prev,
        isActive: !prev.isActive,
        // Reset selection on exit
        pivotDiskId: prev.isActive ? null : prev.pivotDiskId,
        rollingDiskId: prev.isActive ? null : prev.rollingDiskId,
        theta: 0,
        isAnimating: false
    }));

    const selectDisk = (diskId: string) => {
        setState(prev => {
            // 1. Select Pivot
            if (!prev.pivotDiskId) {
                return { ...prev, pivotDiskId: diskId, rollingDiskId: null, theta: 0, isAnimating: false };
            }
            // 2. Deselect Pivot
            if (prev.pivotDiskId === diskId) {
                return { ...prev, pivotDiskId: null, rollingDiskId: null, theta: 0, isAnimating: false };
            }

            // 3. Select Rolling (or change Rolling)
            // Calculate initial theta based on current relative positions
            const pivot = diskBlocks.find(d => d.id === prev.pivotDiskId);
            const rolling = diskBlocks.find(d => d.id === diskId);

            let initialTheta = 0;
            if (pivot && rolling) {
                const dx = rolling.center.x - pivot.center.x;
                const dy = rolling.center.y - pivot.center.y;
                initialTheta = Math.atan2(dy, dx);
            }

            return { ...prev, rollingDiskId: diskId, theta: initialTheta, isAnimating: false };
        });
    };

    const setTheta = (newTheta: number) => {
        setState(prev => {
            // Check collision before allowing manual theta change
            if (prev.pivotDiskId && prev.rollingDiskId) {
                if (checkCollision(newTheta, prev.pivotDiskId, prev.rollingDiskId)) {
                    return prev; // Collision, do not update
                }
            }
            return { ...prev, theta: newTheta };
        });
    };

    const setSpeed = (speed: number) => setState(prev => ({ ...prev, speed }));
    const setShowTrail = (show: boolean) => setState(prev => ({ ...prev, showTrail: show }));
    const toggleAnimation = () => setState(prev => ({ ...prev, isAnimating: !prev.isAnimating }));

    const resetSelection = () => setState(prev => ({
        ...prev,
        pivotDiskId: null,
        rollingDiskId: null,
        theta: 0,
        isAnimating: false
    }));

    return {
        // State
        isActive: state.isActive,
        pivotDiskId: state.pivotDiskId,
        rollingDiskId: state.rollingDiskId,
        theta: state.theta,
        speed: state.speed,
        isAnimating: state.isAnimating,
        showTrail: state.showTrail,

        // Actions
        toggleMode,
        selectDisk,
        setTheta,
        setSpeed,
        setShowTrail,
        toggleAnimation,
        resetSelection
    };
}
