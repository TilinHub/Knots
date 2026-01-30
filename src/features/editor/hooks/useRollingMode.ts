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
    direction: 1 | -1; // 1 = CCW (Antihoraria), -1 = CW (Horaria)
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
        direction: 1,
        isAnimating: false,
        showTrail: true,
    });

    const requestRef = useRef<number | undefined>(undefined);
    const diskBlocks = blocks.filter((b): b is CSDisk => b.kind === 'disk');

    // Collision Logic (Pure function within hook scope)
    const checkCollision = useCallback((currentTheta: number, pivotId: string, rollingId: string): CSDisk | null => {
        const pivot = diskBlocks.find(d => d.id === pivotId);
        const rolling = diskBlocks.find(d => d.id === rollingId);

        if (!pivot || !rolling) return null;

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

            // Collision if distance < sum of visual radii (Strict, no overlap allowed)
            const minDistance = rolling.visualRadius + other.visualRadius;
            // Using a tiny epsilon to handle float precision issues if needed, but strict inequality is usually safer for "no overlap"
            if (dist < minDistance - 0.001) {
                return other; // Return the collided disk
            }
        }
        return null;
    }, [diskBlocks]);

    // Animation Loop using requestAnimationFrame
    const animate = useCallback(() => {
        setState(prev => {
            if (!prev.isAnimating || !prev.pivotDiskId || !prev.rollingDiskId) return prev;

            const step = prev.speed * prev.direction;
            const newTheta = prev.theta + step;

            const collisionDisk = checkCollision(newTheta, prev.pivotDiskId, prev.rollingDiskId);

            if (collisionDisk) {
                // Collision detected at newTheta. The valid position is somewhere between prev.theta and newTheta.
                // Or we can solve for exact theta?
                // Solving for intersection of a circle (pivot+dist) and circle (other+r_rolling) is complex analytically.
                // Simple binary search refinement is robust enough for this frame.

                let low = prev.theta;
                let high = newTheta;
                let validTheta = prev.theta;

                // 10 iterations of binary search is plenty for visual precision
                for (let i = 0; i < 10; i++) {
                    const mid = (low + high) / 2;
                    if (checkCollision(mid, prev.pivotDiskId, prev.rollingDiskId)) {
                        // Collision at mid, go back towards low
                        high = mid;
                    } else {
                        // Safe at mid, try to go further towards high
                        validTheta = mid;
                        low = mid;
                    }
                }

                // Stop at last valid theta
                return { ...prev, theta: validTheta, isAnimating: false };
            }

            return { ...prev, theta: newTheta };
        });

        requestRef.current = requestAnimationFrame(animate);
    }, [checkCollision, diskBlocks]);

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

    // Helper to get current rolling position
    const getCurrentPosition = useCallback(() => {
        if (!state.pivotDiskId || !state.rollingDiskId) return null;
        const pivot = diskBlocks.find(d => d.id === state.pivotDiskId);
        const rolling = diskBlocks.find(d => d.id === state.rollingDiskId);
        if (!pivot || !rolling) return null;

        const dist = pivot.visualRadius + rolling.visualRadius;
        return {
            x: pivot.center.x + dist * Math.cos(state.theta),
            y: pivot.center.y + dist * Math.sin(state.theta)
        };
    }, [state.pivotDiskId, state.rollingDiskId, state.theta, diskBlocks]);

    const setSpeed = (speed: number) => setState(prev => ({ ...prev, speed }));
    const setDirection = (dir: 1 | -1) => setState(prev => ({ ...prev, direction: dir }));
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
        direction: state.direction,
        isAnimating: state.isAnimating,
        showTrail: state.showTrail,

        // Actions
        toggleMode,
        selectDisk,
        setTheta,
        setSpeed,
        setDirection,
        setShowTrail,
        toggleAnimation,
        resetSelection,
        getCurrentPosition
    };
}
