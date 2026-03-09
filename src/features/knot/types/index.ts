import type { CSDisk } from '../../../core/types/cs';

export interface UseKnotStateProps {
    blocks: CSDisk[];
    obstacleSegments?: { p1: { x: number; y: number }; p2: { x: number; y: number } }[];
    ribbonMode?: boolean;
    ribbonWidth?: number;
}

export interface DynamicAnchor {
    diskId: string;
    angle: number;
}
