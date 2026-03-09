import type { CSBlock } from '@/core/types/cs';
import type { DynamicAnchor } from '../../knot/logic/useKnotState';

/**
 * Enhanced entry for the professional Knot Gallery.
 */
export interface KnotGalleryEntry {
    id: string;
    name: string;
    diskSequence: string[];
    chiralities?: ('L' | 'R')[];
    anchorSequence?: DynamicAnchor[];
    frozenPath?: any[];
    blocks: CSBlock[]; // Full scene state for perfect restoration
    thumbnail?: string; // DataURL (PNG/JPEG)
    createdAt: number;
    description?: string;
    color: string;
}
