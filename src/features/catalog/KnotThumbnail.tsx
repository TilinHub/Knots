import { useEffect, useRef } from 'react';

import { buildBoundedCurvatureGraph, findEnvelopePath } from '@/core/geometry/contactGraph';
import { SmoothCSEnvelope } from '@/core/geometry/CSEnvelope';
import type { CSDisk } from '@/core/types/cs';
import { EnvelopeRenderer } from '@/renderer/EnvelopeRenderer';

interface KnotThumbnailProps {
  disks: CSDisk[];
  size?: number;
  showEnvelope?: boolean;
  diskSequence?: string[]; // If provided, reconstructs envelope
  chiralities?: ('L' | 'R')[]; // [NEW] Exact topology
}

// Helper to draw disk - Modified to be very subtle or invisible for "Knot" look
function drawDisk(ctx: CanvasRenderingContext2D, disk: CSDisk & { color?: string }) {
  // If we want a pure knot diagram, we should NOT draw the disks at all.
  // The previous "invisible" stroke might still be visible or affection compositing.
  // We will just return for now if we want "pure mode".
  // But maybe we want to see them faintly in "debug" mode?
  // Let's stick to the user request: "The caratula should be like the image" (Just the curve).
  return;

  /*
    ctx.beginPath();
    ctx.arc(disk.center.x, disk.center.y, disk.visualRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.0)'; 
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
    */
}

export function KnotThumbnail({
  disks,
  size = 100,
  showEnvelope = true,
  diskSequence,
  chiralities,
}: KnotThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Auto-scale to fit
    // Find bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    if (disks.length === 0) return;

    disks.forEach((d) => {
      minX = Math.min(minX, d.center.x - d.visualRadius);
      maxX = Math.max(maxX, d.center.x + d.visualRadius);
      minY = Math.min(minY, d.center.y - d.visualRadius);
      maxY = Math.max(maxY, d.center.y + d.visualRadius);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const maxDim = Math.max(width, height) || 100;

    // Scale to fit size with padding
    const scale = (size - 10) / maxDim;

    // Clear
    ctx.clearRect(0, 0, size, size);
    ctx.save();

    // Center view
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, -scale); // Flip Y to match core geometry (Y-up) vs Canvas (Y-down)
    ctx.translate(-cx, -cy);

    // Draw Disks
    disks.forEach((d) => {
      // Re-flip for text if we were drawing it?
      // drawDisk does not draw text anymore.
      drawDisk(ctx, { ...d, color: '#e0e0e0' });
    });

    // Draw Envelope if requested
    if (showEnvelope && diskSequence && diskSequence.length >= 2) {
      try {
        // Rebuild graph locally for rendering
        const contactDisks = disks.map((d) => ({
          id: d.id,
          center: d.center,
          radius: d.visualRadius,
          regionId: 't',
          color: 'blue',
        }));
        const graph = buildBoundedCurvatureGraph(contactDisks, true);

        // [FIX] Use passed chiralities to enforce exact shape?
        // If chiralities are provided, we should use them.
        const pathRes = findEnvelopePath(graph, diskSequence, chiralities || undefined);

        // Use EXACT path rendering (segments)
        ctx.beginPath();
        // Draw path segments
        pathRes.path.forEach((seg) => {
          if (seg.type === 'ARC') {
            // Arc Segment
            // Chirality L=CCW, R=CW.
            // Context is Y-flipped (det < 0), so 'anticlockwise' arg meaning is flipped.
            // True normally means CCW. Here it might mean CW.
            // Let's assume:
            // L (CCW in math) -> We want CCW visual -> Need 'false' in flipped ctx?
            // Or maybe 'true' means "Decrease Angle"?
            // Let's rely on standard logic:
            // L: traverse +Angle direction?
            // R: traverse -Angle direction?

            // Actually contactGraph.ts says:
            // "L=CCW, R=CW"
            // ContactPathRenderer uses: sweep = (chirality === 'L' ? 1 : 0)
            // In SVG, sweep=1 is Positive Angle (usually CW in screen, CCW in Y-up).
            // In Canvas (Y-up transform), 'anticlockwise=false' is Positive Angle.
            // So 'L' (CCW) -> Positive -> anticlockwise=false.
            // 'R' (CW) -> Negative -> anticlockwise=true.

            const isCCW = seg.chirality === 'L';
            const anticlockwise = !isCCW; // false if CCW

            ctx.arc(
              seg.center.x,
              seg.center.y,
              seg.radius,
              seg.startAngle,
              seg.endAngle,
              anticlockwise,
            );
          } else {
            // Tangent Segment
            ctx.moveTo(seg.start.x, seg.start.y);
            ctx.lineTo(seg.end.x, seg.end.y);
          }
        });
        ctx.stroke();
      } catch (e) {
        // Ignore render errors in thumbnail
      }
    }

    ctx.restore();
  }, [disks, size, showEnvelope, diskSequence, chiralities]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
}
