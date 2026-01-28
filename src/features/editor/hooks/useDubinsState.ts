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

export function useDubinsState() {
    const [isActive, setIsActive] = useState(false);
    const [startConfig, setStartConfig] = useState<Config | null>(null);
    const [endConfig, setEndConfig] = useState<Config | null>(null);
    const [rho, setRho] = useState<number>(50);
    const [visiblePaths, setVisiblePaths] = useState<Set<DubinsType>>(new Set(['LSL', 'RSR', 'LSR', 'RSL', 'RLR', 'LRL']));
    const [maxPathsToShow, setMaxPathsToShow] = useState<number>(6); // Default 6 (show all relevant if checked)

    // Disk Selection State
    const [startDiskId, setStartDiskId] = useState<string | null>(null);
    const [endDiskId, setEndDiskId] = useState<string | null>(null);

    // Helper to calculate config from disk centers
    // Heuristic: Angle is from Start Center -> End Center
    const updateConfigsFromDisks = useCallback((sDisk: ContactDisk | null, eDisk: ContactDisk | null) => {
        if (sDisk && eDisk) {
            const dx = eDisk.center.x - sDisk.center.x;
            const dy = eDisk.center.y - sDisk.center.y;
            const theta = Math.atan2(dy, dx); // Angle pointing from start to end

            // Start configuration: Center of Start Disk, pointing to End Disk
            setStartConfig({
                x: sDisk.center.x,
                y: sDisk.center.y,
                theta: theta
            });

            // End configuration: Center of End Disk, pointing SAME direction (Parallel parking style)
            // Or maybe pointing into the disk? Let's use same direction for now as 'transport' logic
            setEndConfig({
                x: eDisk.center.x,
                y: eDisk.center.y,
                theta: theta
            });
        }
    }, []);

    const selectDisk = useCallback((disk: ContactDisk) => {
        if (!startDiskId) {
            setStartDiskId(disk.id);
            // If we have an end disk selected previously (edge case?), or just set start
            // If end disk matches start, clear end?
            if (endDiskId === disk.id) setEndDiskId(null);
        } else {
            // Start is already set, so this is the end disk
            // UNLESS we clicked the start disk again? Let's allow re-selecting end easily.
            if (startDiskId === disk.id) {
                // Deselect start? or just ignore? Let's deselect to allow changing start.
                setStartDiskId(null);
                setStartConfig(null);
                setEndConfig(null);
                return;
            }
            setEndDiskId(disk.id);

            // Trigger calculation logic immediately if we have the disk objects
            // But we only have IDs here + the disk passed in.
            // We need access to the OTHER disk object to compute configs. 
            // We can't do it purely inside this reducer-like function without the disk list or passing both disks.
            // A pattern adjustment: selectDisk takes (disk, allDisks) OR we just store IDs and compute configs in a useEffect?
            // Storing IDs + useEffect is safer for consistency but `allDisks` might be expensive to traverse if huge? No, it's small.
            // BETTER: pass the other disk if available? No, UI calls this.
            // Let's rely on the consumed component to pass the "current" disks or ...
            // ACTUALLY: The UI (CSCanvas) knows all disks. It could pass `selectDisk(disk, allDisks)`.
            // OR simpler: selectDisk just helps Toggle IDs. The configs are updated by an Effect in this hook IF we had access to disks.
            // BUT we don't have disks in this hook.
            // So: We will store IDs here. And we need a specialized function `updateConfigs(startDisk, endDisk)` exposed?
            // OR `selectDisk` logic handles just ID state, and we expose `setConfigsFromDisks` to be called by the `useEffect` in the component?
            // "Declarative" approach: 
            // The hook shouldn't know about "ContactDisk" objects details if possible, but it imports Config.
            // Let's stick to: we return `startDiskId`, `endDiskId` and specific setters.
            // The UI (EditorPage) will observe these IDs and call `setStartConfig`/`setEndConfig` accordingly?
            // OR we move the disk list INTO this hook? No, state separation is good.

            // For now, let's keep it simple: Start/End ID state is here.
            // We return a helper `notifyDiskSelected(disk: ContactDisk, allDisks: ContactDisk[])`.
        }
    }, [startDiskId, endDiskId]);

    // Alternative: purely manual Config setting is still allowed if IDs are null.
    // Toggling mode resets everything?
    const toggleMode = useCallback(() => {
        setIsActive(prev => {
            if (prev) {
                // Turning OFF
                setStartDiskId(null);
                setEndDiskId(null);
                setStartConfig(null);
                setEndConfig(null);
                return false;
            }
            return true;
        });
    }, []);

    // Logic to select disk with data
    const handleDiskSelect = useCallback((disk: ContactDisk, allDisks: ContactDisk[]) => {
        // Logic moved here to be self-contained if we pass the array
        // But wait, if we are just clicking ONE disk, we don't want to pass the huge array every click if unnecessary.
        // Let's optimize:
        // The state is: startDiskId, endDiskId.

        let newStart = startDiskId;
        let newEnd = endDiskId;

        if (!startDiskId) {
            setStartDiskId(disk.id);
            newStart = disk.id;
            // If we just set start, we can't compute path yet unless end is already there (unlikely if we clear on close)
        } else if (startDiskId === disk.id) {
            // Deselect start
            setStartDiskId(null);
            setStartConfig(null);
            setEndConfig(null);
            setEndDiskId(null);
            return;
        } else {
            setEndDiskId(disk.id);
            newEnd = disk.id;
        }

        // Attempt to compute configs if both exist
        if (newStart && newEnd) {
            const sDisk = newStart === disk.id ? disk : allDisks.find(d => d.id === newStart);
            const eDisk = newEnd === disk.id ? disk : allDisks.find(d => d.id === newEnd);

            if (sDisk && eDisk) {
                updateConfigsFromDisks(sDisk, eDisk);
            }
        }

    }, [startDiskId, endDiskId, updateConfigsFromDisks]);


    const computedPaths = useMemo(() => {
        if (!startConfig || !endConfig) return [];
        return calculateDubinsPaths(startConfig, endConfig, rho);
    }, [startConfig, endConfig, rho]);

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
