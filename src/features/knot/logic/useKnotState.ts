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

    // [NEW] Lock refs for debouncing and preventing concurrent recalculations
    const recalcLockRef = useRef(false);
    const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        // GUARDS: Condiciones para NO ejecutar
        if (isDragging) return;
        if (diskSequence.length < 2) return;
        
        const pathIsEmpty = computationResult.path.length === 0;
        const pathIsTooShort = computationResult.path.length < diskSequence.length - 1;
        
        if (!pathIsEmpty && !pathIsTooShort) return;
        if (recalcLockRef.current) {
            console.log('⏸️ Recálculo bloqueado - lock activo');
            return;
        }
        
        console.warn('⚠️ PATH INVÁLIDO DETECTADO');
        console.log('  📊 Estado:', {
            diskSeqLen: diskSequence.length,
            pathLen: computationResult.path.length,
            anchorsCount: anchorSequence.length
        });
        
        // Activar lock ANTES de cualquier modificación de estado
        recalcLockRef.current = true;
        
        try {
            const graph = buildBoundedCurvatureGraph(contactDisks, true, [], true);
            
            console.log('  🔗 Grafo:', { nodes: graph.nodes.size, edges: graph.edges.length });
            
            if (graph.edges.length === 0) {
                console.error('  ❌ Grafo vacío - discos muy separados o sin tangentes válidas');
                return;
            }
            
            const elasticResult = findEnvelopePath(graph, diskSequence, undefined, false);
            
            console.log('  🎯 Elastic path:', elasticResult.path.length, 'segments');
            
            if (elasticResult.path.length === 0) {
                console.error('  ❌ Elastic solver falló - no se encontró path válido');
                return;
            }
            
            const newAnchors: DynamicAnchor[] = [];
            const seenDisks = new Set<string>();
            
            elasticResult.path.forEach(seg => {
                if (!('startDiskId' in seg)) return;
                
                const diskId = seg.startDiskId;
                if (diskId === 'start' || diskId === 'end' || diskId === 'point') return;
                if (seenDisks.has(diskId)) return;
                
                const disk = blocks.find(b => b.id === diskId && b.kind === 'disk');
                if (!disk) return;
                
                const angle = Math.atan2(seg.start.y - disk.center.y, seg.start.x - disk.center.x);
                
                newAnchors.push({ diskId, angle });
                seenDisks.add(diskId);
            });
            
            if (newAnchors.length < 2) {
                console.error('  ❌ Insuficientes anchors extraídos:', newAnchors.length);
                return;
            }
            
            console.log('  ✅ Topología reconstruida:', newAnchors.length, 'anchors');
            setAnchorSequence(newAnchors);
            
        } catch (error) {
            console.error('  ❌ Error en recálculo automático:', error);
        } finally {
            // Cleanup del timeout anterior si existe
            if (recalcTimeoutRef.current) {
                clearTimeout(recalcTimeoutRef.current);
            }
            
            // Programar liberación del lock con debouncing
            recalcTimeoutRef.current = setTimeout(() => {
                recalcLockRef.current = false;
                console.log('  🔓 Lock liberado después de debounce');
            }, 500);
        }
        
        // Cleanup al desmontar
        return () => {
            if (recalcTimeoutRef.current) {
                clearTimeout(recalcTimeoutRef.current);
            }
        };
        
    }, [
        isDragging,                      // Trigger cuando termina drag
        diskSequence.length,             // Solo longitud, no array completo
        computationResult.path.length    // Solo longitud, no path completo
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
