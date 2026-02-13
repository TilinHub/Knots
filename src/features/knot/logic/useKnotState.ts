
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { CSDisk } from '../../../core/types/cs';
import { findEnvelopePathFromPoints, type EnvelopePathResult, buildBoundedCurvatureGraph, findEnvelopePath } from '../../../core/geometry/contactGraph';
import { validateNoSelfIntersection, validateNoObstacleIntersection } from '../../../core/validation/envelopeValidator';

interface UseKnotStateProps {
    blocks: CSDisk[]; // We need disks to build the graph
    obstacleSegments?: { p1: { x: number, y: number }, p2: { x: number, y: number } }[]; // [NEW] Obstacles
}

export interface DynamicAnchor {
    diskId: string;
    angle: number; // Angle relative to disk center
}

export function useKnotState({ blocks, obstacleSegments = [] }: UseKnotStateProps) {
    const [mode, setMode] = useState<'hull' | 'knot'>('hull'); // 'hull' = off/hidden, 'knot' = active
    const [diskSequence, setDiskSequence] = useState<string[]>([]);

    // [NEW] Dynamic Anchors (Stored as relative angles)
    const [anchorSequence, setAnchorSequence] = useState<DynamicAnchor[]>([]);

    // [FIX] Freeze anchors during drag to prevent deformation
    const [isDragging, setIsDragging] = useState(false);
    const prevAnchorsRef = React.useRef<{ x: number, y: number }[]>([]);

    // Legacy/Derivative
    const [chiralities, setChiralities] = useState<('L' | 'R')[]>([]);
    const [lastAnchorPoint, setLastAnchorPoint] = useState<{ x: number, y: number } | null>(null);

    // 1. Build Graph (Memoized)
    const contactDisks = useMemo(() => blocks.map(d => ({
        id: d.id,
        center: d.center,
        radius: d.visualRadius,
        regionId: 'default'
    })), [blocks]);

    // Cleanup sequence if disks are removed
    useEffect(() => {
        setDiskSequence(prev => prev.filter(id => blocks.some(b => b.id === id)));
        setAnchorSequence(prev => prev.filter(a => blocks.some(b => b.id === a.diskId)));
    }, [blocks]);

    // [NEW] Recalculate Absolute Positions (Reactive to blocks moving)
    const currentAnchors = useMemo(() => {
        // [FIX] If dragging and we have previous valid anchors, freeze them
        if (isDragging && prevAnchorsRef.current.length > 0) {
            return prevAnchorsRef.current;
        }

        const newAnchors = anchorSequence.map(anchor => {
            const disk = blocks.find(b => b.id === anchor.diskId);
            if (!disk) return { x: 0, y: 0 }; // Should be cleaned up by effect
            return {
                x: disk.center.x + disk.visualRadius * Math.cos(anchor.angle),
                y: disk.center.y + disk.visualRadius * Math.sin(anchor.angle)
            };
        });

        // Update cache
        prevAnchorsRef.current = newAnchors;
        return newAnchors;
    }, [anchorSequence, blocks, isDragging]);

    // 2. Compute Path (Strict Point-to-Point)
    const computationResult: EnvelopePathResult = useMemo(() => {
        if (currentAnchors.length < 2) return { path: [], chiralities: [] };

        // Use the DYNAMICALLY updated positions
        return findEnvelopePathFromPoints(currentAnchors, contactDisks);
    }, [currentAnchors, contactDisks]);

    // 3. Validation
    const validation = useMemo(() => {
        if (!computationResult.path || computationResult.path.length < 3) return { valid: true };

        // Check self-intersection
        const selfCheck = validateNoSelfIntersection(computationResult.path);
        if (!selfCheck.valid) return selfCheck;

        // Check obstacles
        if (obstacleSegments.length > 0) {
            const obsCheck = validateNoObstacleIntersection(computationResult.path, obstacleSegments);
            if (!obsCheck.valid) return obsCheck;
        }

        return { valid: true };
    }, [computationResult.path, obstacleSegments]);

    // ═══════════════════════════════════════════════════════════════
    // AUTO-CORRECCIÓN: Recalcular topología si path se invalida
    // ═══════════════════════════════════════════════════════════════

    useEffect(() => {
        // Solo ejecutar cuando NO estamos arrastrando y después de soltar
        if (isDragging) return;

        // Solo si hay una envolvente activa (diskSequence definido)
        if (diskSequence.length < 2) return;

        // Detectar path inválido (Empty, Short, o INVALIDO por intersección)
        const pathIsEmpty = computationResult.path.length === 0;
        const pathIsTooShort = computationResult.path.length < diskSequence.length - 1;
        const pathIsInvalid = !validation.valid; // [NEW] Trigger on self-intersection

        if (pathIsEmpty || pathIsTooShort || pathIsInvalid) {
            console.warn('⚠️ ENVOLVENTE NECESITA CORRECCIÓN. Iniciando recálculo...', {
                pathIsEmpty,
                pathIsTooShort,
                pathIsInvalid
            });

            try {
                // Construir grafo con posiciones ACTUALES de discos
                const graph = buildBoundedCurvatureGraph(
                    contactDisks,
                    true,   // checkCollisions = true
                    [],     // no obstacles
                    true    // outerTangentsOnly = true (previene auto-intersección)
                );

                console.log('  - Graph edges:', graph.edges.length);

                // Resolver path usando secuencia de discos (elastic band)
                // NO forzar chiralities para permitir adaptación
                const elasticResult = findEnvelopePath(
                    graph,
                    diskSequence,
                    undefined,  // chiralities = undefined (permitir re-solver)
                    false       // strictChirality = false
                );

                console.log('  - Elastic path length:', elasticResult.path.length);

                if (elasticResult.path.length > 0) {
                    // ✅ Path recalculado exitosamente
                    // Extraer nuevos anchors desde el path
                    const newAnchors: DynamicAnchor[] = [];

                    elasticResult.path.forEach((seg, idx) => {
                        if ('startDiskId' in seg) {
                            const diskId = seg.startDiskId;

                            // Ignorar pseudo-disks
                            if (diskId === 'start' || diskId === 'end' || diskId === 'point') {
                                return;
                            }

                            const disk = blocks.find(b => b.id === diskId && b.kind === 'disk');
                            if (!disk) return;

                            // Calcular ángulo del punto de tangencia
                            const angle = Math.atan2(
                                seg.start.y - disk.center.y,
                                seg.start.x - disk.center.x
                            );

                            // Evitar duplicados (mismo diskId consecutivo)
                            if (newAnchors.length === 0 || newAnchors[newAnchors.length - 1].diskId !== diskId) {
                                newAnchors.push({ diskId, angle });
                            }
                        }
                    });

                    if (newAnchors.length >= 2) {
                        // [FIX] Prevent infinite loop: Check if anchors actually changed
                        const hasChanges = newAnchors.length !== anchorSequence.length || newAnchors.some((newAnchor, i) => {
                            const oldAnchor = anchorSequence[i];
                            return newAnchor.diskId !== oldAnchor.diskId || Math.abs(newAnchor.angle - oldAnchor.angle) > 1e-4;
                        });

                        if (hasChanges) {
                            console.log('✅ Topología reconstruida:', newAnchors.length, 'anchors');
                            setAnchorSequence(newAnchors);
                        } else {
                            console.log('⏹️ Anchors estables - omitiendo actualización');
                        }
                    } else {
                        console.error('❌ No se pudieron extraer anchors válidos del path elástico');
                    }
                } else {
                    console.error('❌ Elastic solver falló - path vacío');
                }

            } catch (error) {
                console.error('❌ Error en recálculo automático:', error);
            }
        }
    }, [
        isDragging,              // Trigger cuando termina drag
        diskSequence,            // Trigger si secuencia cambia
        computationResult.path,  // Trigger si path se invalida
        contactDisks,            // Posiciones actualizadas
        blocks,                  // Para lookups
        anchorSequence,          // Evitar loop infinito (solo si anchorSequence es estable)
        validation.valid         // [NEW] Trigger si la validación cambia
    ]);

    // Actions
    const knotPath = computationResult.path;

    const toggleDisk = useCallback((diskId: string) => {
        setDiskSequence(prev => {
            if (prev.length > 0 && prev[prev.length - 1] === diskId) {
                // Remove last
                setLastAnchorPoint(null);
                setAnchorSequence(prevA => prevA.slice(0, -1));
                setChiralities(prevC => prevC.slice(0, -1));
                return prev.slice(0, -1);
            }
            return [...prev, diskId];
        });
    }, []);

    const toggleMode = useCallback(() => {
        setMode(prev => prev === 'hull' ? 'knot' : 'hull');
    }, []);

    const clearSequence = useCallback(() => {
        setDiskSequence([]);
        setChiralities([]);
        setAnchorSequence([]);
        setLastAnchorPoint(null);
    }, []);

    // Point-based extension (Strict Point-to-Point)
    const extendSequenceWithPoint = useCallback((diskId: string, point: { x: number, y: number }) => {
        // Find disk to calculate angle
        const disk = blocks.find(b => b.id === diskId);
        if (!disk) return;

        const angle = Math.atan2(point.y - disk.center.y, point.x - disk.center.x);

        setAnchorSequence(prev => [
            ...prev,
            { diskId, angle }
        ]);

        // We still track diskSequence for metadata/UI feedback
        setDiskSequence(prev => [...prev, diskId]);

        setLastAnchorPoint(point); // This might be slightly off if disk moves immediately, but acts as "last click"
    }, [blocks]);

    return {
        mode,
        diskSequence,
        knotPath,
        chiralities: computationResult.chiralities,
        anchorPoints: currentAnchors, // [RENAMED] Absolute points for rendering
        anchorSequence, // [NEW] Raw dynamic anchors for persistence
        validation, // [NEW] Expose validation result
        actions: {
            setMode,
            toggleMode,
            toggleDisk,
            setSequence: setDiskSequence,
            clearSequence,
            // [NEW] Allow setting anchors directly (for loading)
            setAnchorSequence,
            extendSequenceWithPoint,
            setDragging: setIsDragging // [FIX] Expose drag control
        }
    };
}
