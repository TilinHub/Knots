import React, { useMemo } from 'react';

import type { EnvelopeSegment } from '../../core/geometry/contactGraph'; // Correct import?
import type { CSDisk } from '../../core/types/cs';
import { KnotEnvelopeComputer } from '../../features/knot/logic/KnotEnvelopeComputer';
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

// Helper to convert envelope segments to a single closed SVG path for filling
function segmentsToPath(segments: EnvelopeSegment[]): string {
  if (!segments || segments.length === 0) return '';

  return (
    segments
      .map((seg, i) => {
        // Calculate start/end points
        let startX, startY, endX, endY;

        if (seg.type === 'ARC') {
          startX = seg.center.x + seg.radius * Math.cos(seg.startAngle);
          startY = seg.center.y + seg.radius * Math.sin(seg.startAngle);

          let effEndAngle = seg.endAngle;
          // [FIX] SVG completely drops Arc commands where start exactly equals end.
          // If the arc is exactly a full circle, slightly offset the end point.
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

        // Move to start only for first segment
        const move = i === 0 ? `M ${startX} ${startY}` : '';

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

  // 1. Compute Knot Envelope (Robust Hull OR Elastic Band)
  const computer = useMemo(() => new KnotEnvelopeComputer(), []);
  const knotEnvelopePath = useMemo(() => {
    if (!showEnvelope || disks.length === 0) return [];
    if (!knotMode) return [];

    // Use the new topology-aware compute
    return computer.compute(disks, { sequence: knotSequence, chiralities: knotChiralities });
  }, [disks, showEnvelope, computer, knotMode, knotSequence, knotChiralities]);

  return (
    <BaseLayer visible={visible} zIndex={10}>
      <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
        {/* Robust Envelope (Active) - Only in Knot Mode */}
        {showEnvelope && knotMode && (
          <>
            {/* Fill */}
            <path
              d={segmentsToPath(knotEnvelopePath)}
              fill={envelopeColor || '#5CA0D3'}
              fillOpacity={0.1}
              stroke="none"
              style={{ pointerEvents: 'none' }} // Let clicks pass through
            />
            {/* Stroke */}
            <PathLayer path={knotEnvelopePath} color={envelopeColor || '#5CA0D3'} width={2} />
          </>
        )}

        {savedKnotPaths.map((k) => (
          <PathLayer
            key={k.id}
            path={k.path}
            // If savedEnvelopeColor is explicitly provided (controlled), use it.
            // Otherwise fall back to k.color (if saved with one) or default.
            // Note: savedEnvelopeColor comes from state, so it might be the default #5CA0D3 if not touched.
            // Use it if defined.
            color={savedEnvelopeColor || k.color || '#FF4500'}
            width={5}
          />
        ))}

        {/* Active Knot Path - Only in Knot Mode */}
        {knotMode && <PathLayer path={knotPath} color="#FF0000" width={2} />}

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
