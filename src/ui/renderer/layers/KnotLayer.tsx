import React, { useMemo } from 'react';

import type { EnvelopeSegment, TangentSegment } from '../../../core/geometry/envelope/contactGraph';
import { intersectsAnyDiskStrict } from '../../../core/geometry/envelope/collision';
import type { CSDisk } from '../../../core/types/cs';
import type { LayerProps } from '../types/Layer';
import { BaseLayer } from './BaseLayer';
import { PathLayer } from './PathLayer';

interface KnotLayerProps extends LayerProps {
  knotPath: EnvelopeSegment[];
  knotSequence?: string[]; // [NEW]
  knotChiralities?: string[]; // [NEW]
  anchorPoints: { x: number; y: number }[];
  showEnvelope: boolean;
  envelopeColor?: string;
  savedEnvelopeColor?: string; // [NEW]
  knotMode?: boolean;
  onKnotPointClick?: (diskId: string, point: { x: number; y: number }) => void;
  savedKnotPaths?: { id: string; color: string; path: EnvelopeSegment[] }[];
}

// Helper to convert envelope segments to a single closed SVG path for filling.
// Inserts M (MoveTo) commands when consecutive segments are discontinuous
// to prevent SVG from drawing implicit straight lines through disk interiors.
function segmentsToPath(segments: EnvelopeSegment[]): string {
  if (!segments || segments.length === 0) return '';

  const GAP_TOL = 0.5; // Tolerance for detecting gaps between segments
  let prevEndX = 0, prevEndY = 0;

  return (
    segments
      .map((seg, i) => {
        let startX: number, startY: number, endX: number, endY: number;

        if (seg.type === 'ARC') {
          startX = seg.center.x + seg.radius * Math.cos(seg.startAngle);
          startY = seg.center.y + seg.radius * Math.sin(seg.startAngle);

          let effEndAngle = seg.endAngle;
          const isFullCircle = Math.abs(seg.length - 2 * Math.PI * seg.radius) < 1e-4;
          if (isFullCircle) {
            effEndAngle += seg.chirality === 'L' ? -0.001 : 0.001;
          }

          endX = seg.center.x + seg.radius * Math.cos(effEndAngle);
          endY = seg.center.y + seg.radius * Math.sin(effEndAngle);
        } else {
          startX = seg.start.x;
          startY = seg.start.y;
          endX = seg.end.x;
          endY = seg.end.y;
        }

        // Insert M if first segment or if there's a gap from previous segment end
        let move = '';
        if (i === 0) {
          move = `M ${startX} ${startY}`;
        } else {
          const dx = startX - prevEndX;
          const dy = startY - prevEndY;
          if (dx * dx + dy * dy > GAP_TOL * GAP_TOL) {
            move = `M ${startX} ${startY}`;
          }
        }

        prevEndX = endX;
        prevEndY = endY;

        if (seg.type === 'ARC') {
          const largeArc = seg.length > Math.PI * seg.radius ? 1 : 0;
          const sweep = seg.chirality === 'L' ? 1 : 0;
          return `${move} A ${seg.radius} ${seg.radius} 0 ${largeArc} ${sweep} ${endX} ${endY}`;
        } else {
          return `${move} L ${endX} ${endY}`;
        }
      })
      .join(' ') + ' Z'
  );
}

export const KnotLayer: React.FC<KnotLayerProps> = ({
  visible,
  blocks,
  knotPath,
  knotSequence, // [NEW]
  knotChiralities, // [NEW]
  anchorPoints,
  showEnvelope,
  envelopeColor,
  savedEnvelopeColor, // [NEW]
  knotMode,
  onKnotPointClick,
  context,
  savedKnotPaths = [],
}) => {
  if (!visible) return null; // Show even if not knotMode? No, user implied "knot mode envelope".
  // Actually, saved knots might want to be visible always?
  // The previous code in CSCanvas passed them.
  // If they are specific to Knot Mode, then (!visible || !knotMode) return null is fine.
  // But usually saved stuff is visible for reference.
  // However, the prompt says "La envolvente del knot mode".
  // Let's stick to showing them only in Knot Mode for now, OR if they were always visible before.
  // In monolithic CSCanvas, they were rendered if `savedKnotPaths` existed.
  // Let's assume they should be visible if passed.
  // But KnotLayer has `if (!visible || !knotMode) return null;`
  // I will keep it strict to Knot Mode for now as per "KnotLayer".

  if (!visible) return null;

  // ... (rest of filtering)

  // Dimensions for transform
  const { width = 800, height = 600 } = context || {};
  const centerX = width / 2;
  const centerY = height / 2;

  const disks = useMemo(() => blocks.filter((b): b is CSDisk => b.kind === 'disk'), [blocks]);

  // Last line of defense: filter any tangent that crosses a non-sequence visual disk.
  // Sequence disks are allowed — crossings form where the curve crosses them.
  const sequenceDiskIds = useMemo(() => new Set(knotSequence ?? []), [knotSequence]);
  const safeKnotPath = useMemo(() => {
    if (!knotPath || knotPath.length === 0 || disks.length === 0) return knotPath;
    const blockingDisks = disks
      .filter((d) => !sequenceDiskIds.has(d.id))
      .map((d) => ({
        id: d.id, center: d.center, radius: d.visualRadius, regionId: 'default',
      }));
    if (blockingDisks.length === 0) return knotPath; // All disks are in sequence — nothing to block
    return knotPath.filter((seg: EnvelopeSegment) => {
      if (seg.type === 'ARC') return true;
      const tan = seg as TangentSegment;
      return !intersectsAnyDiskStrict(tan.start, tan.end, blockingDisks, tan.startDiskId, tan.endDiskId);
    });
  }, [knotPath, disks, sequenceDiskIds]);

  return (
    <BaseLayer visible={visible} zIndex={10}>
      <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
        {/* Envelope (from knotPath which respects user anchors) - Only in Knot Mode */}
        {showEnvelope && knotMode && safeKnotPath && safeKnotPath.length > 0 && (
          <>
            {/* Fill */}
            <path
              d={segmentsToPath(safeKnotPath)}
              fill={envelopeColor || '#5CA0D3'}
              fillOpacity={0.1}
              stroke="none"
              style={{ pointerEvents: 'none' }}
            />
            {/* Stroke */}
            <PathLayer path={safeKnotPath} color={envelopeColor || '#5CA0D3'} width={2} />
          </>
        )}

        {savedKnotPaths.map((k) => {
          // Validate saved paths against current disk positions
          const obsList = disks.map((d) => ({
            id: d.id, center: d.center, radius: d.visualRadius, regionId: 'default',
          }));
          const safePath = k.path.filter((seg: EnvelopeSegment) => {
            if (seg.type === 'ARC') return true;
            const tan = seg as TangentSegment;
            return !intersectsAnyDiskStrict(tan.start, tan.end, obsList, tan.startDiskId, tan.endDiskId);
          });
          return (
            <PathLayer
              key={k.id}
              path={safePath}
              color={savedEnvelopeColor || k.color || '#FF4500'}
              width={5}
            />
          );
        })}

        {/* Active Knot Construction Path - Always visible in Knot Mode */}
        {knotMode && safeKnotPath && safeKnotPath.length > 0 && (
          <PathLayer path={safeKnotPath} color="#FF0000" width={3} />
        )}

        {/* Debug Anchors */}
        {anchorPoints &&
          anchorPoints.map((p, i) => (
            <circle
              key={`anchor-${i}`}
              cx={p.x}
              cy={p.y}
              r={6}
              fill="#8A2BE2"
              stroke="white"
              strokeWidth={2}
              pointerEvents="none"
            />
          ))}

        {/* Clickable Anchors (N/S/E/W) logic moved from CSCanvas? 
                 CSCanvas renders anchors on top of disks using SVG coords. 
                 This is tricky because `toSVG` is in Canvas.
                 We will keep Clickable Anchors in CSCanvas (Disk Layer) for now to minimize risk 
                 or move `toSVG` to a utility context. 
                 Since Step 1 is "Scaffolding", we can leave interactables in Canvas and move only Paths here.
                 The task said "KnotLayer (renders knot path & envelope)".
             */}
      </g>
    </BaseLayer>
  );
};
