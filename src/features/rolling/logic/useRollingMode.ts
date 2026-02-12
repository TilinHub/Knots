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

    // Helper to find intersection angles (valid contact points)
    const solveContactTheta = (pivot: CSDisk, rolling: CSDisk, obstacle: CSDisk): number | null => {
        // We want to find theta such that rolling disk touches both Pivot and Obstacle.
        // This effectively means finding the intersection of two circles:
        // C1: Center=Pivot, Radius = R_pivot + R_rolling
        // C2: Center=Obstacle, Radius = R_obstacle + R_rolling

        const r1 = pivot.visualRadius + rolling.visualRadius;
        const r2 = obstacle.visualRadius + rolling.visualRadius;

        const dx = obstacle.center.x - pivot.center.x;
        const dy = obstacle.center.y - pivot.center.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        // Check solvability
        if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return null;

        // Triangle cosine rule / circle intersection math
        const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
        const h = Math.sqrt(r1 * r1 - a * a);

        // P2 = P1 + a * (P2 - P1) / d
        const x2 = pivot.center.x + a * (dx / d);
        const y2 = pivot.center.y + a * (dy / d);

        // Intersection points
        const tx1 = x2 + h * (dy / d);
        const ty1 = y2 - h * (dx / d);

        const tx2 = x2 - h * (dy / d);
        const ty2 = y2 + h * (dx / d);

        // We return two angles relative to Pivot center
        const theta1 = Math.atan2(ty1 - pivot.center.y, tx1 - pivot.center.x);
        const theta2 = Math.atan2(ty2 - pivot.center.y, tx2 - pivot.center.x);

        // We return the one closest to current theta? Or just both?
        // Let caller decide. For now, let's just picking the best later? 
        // No, let's just helper return both candidates.
        // Actually, let's just make this simpler: Return ALL valid thetas, caller picks closest.
        return null; // Using internal logic in selectDisk for now.
    };

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

            if (!pivot || !rolling) return prev;

            let initialTheta = 0;
            const dx = rolling.center.x - pivot.center.x;
            const dy = rolling.center.y - pivot.center.y;
            initialTheta = Math.atan2(dy, dx);

            // CHECK FOR OVERLAP ON START
            // If the current position is valid, great.
            // If it overlaps, we must find the nearest valid 'tangent' position to the obstacle.
            let bestTheta = initialTheta;
            let minDiff = Infinity;
            let foundCollision = false;

            // Collision Logic - check against ALL other disks
            for (const other of diskBlocks) {
                if (other.id === pivot.id || other.id === rolling.id) continue;

                // Check overlap at initialTheta
                const distDist = pivot.visualRadius + rolling.visualRadius;
                const rollX = pivot.center.x + distDist * Math.cos(initialTheta);
                const rollY = pivot.center.y + distDist * Math.sin(initialTheta);

                const dX = rollX - other.center.x;
                const dY = rollY - other.center.y;
                const dist = Math.sqrt(dX * dX + dY * dY);
                const minDist = rolling.visualRadius + other.visualRadius;

                if (dist < minDist - 0.001) {
                    foundCollision = true;
                    // Overlap detected! Find intersection thetas
                    // Center distance pivot-other
                    const pdX = other.center.x - pivot.center.x;
                    const pdY = other.center.y - pivot.center.y;
                    const d = Math.sqrt(pdX * pdX + pdY * pdY);

                    const r1 = pivot.visualRadius + rolling.visualRadius; // Pivot-Rolling dist
                    const r2 = other.visualRadius + rolling.visualRadius; // Other-Rolling dist (contact)

                    // Triangle solution
                    if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) continue; // Unsolvable

                    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
                    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

                    const x2 = pivot.center.x + a * (pdX / d);
                    const y2 = pivot.center.y + a * (pdY / d);

                    // Two possible positions for rolling center
                    const rx1 = x2 + h * (pdY / d);
                    const ry1 = y2 - h * (pdX / d);

                    const rx2 = x2 - h * (pdY / d);
                    const ry2 = y2 + h * (pdX / d);

                    const t1 = Math.atan2(ry1 - pivot.center.y, rx1 - pivot.center.x);
                    const t2 = Math.atan2(ry2 - pivot.center.y, rx2 - pivot.center.x);

                    // Normalize angles to be close to initialTheta
                    const normalize = (t: number) => Math.atan2(Math.sin(t), Math.cos(t));

                    // Simple distance check on unit circle
                    const diff1 = Math.abs(normalize(t1 - initialTheta));
                    const diff2 = Math.abs(normalize(t2 - initialTheta));

                    if (diff1 < minDiff) { minDiff = diff1; bestTheta = t1; }
                    if (diff2 < minDiff) { minDiff = diff2; bestTheta = t2; }
                }
            }

            return { ...prev, rollingDiskId: diskId, theta: foundCollision ? bestTheta : initialTheta, isAnimating: false };
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
