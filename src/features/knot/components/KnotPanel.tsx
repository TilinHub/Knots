import React, { useState } from 'react';

import { Button } from '../../../ui/components/Button';
import { ContactMatrixViewer } from '../../editor/components/ContactMatrixViewer';

interface KnotPanelProps {
  knotState: any;
  editorState: any;
  actions: any;
}

export const KnotPanel: React.FC<KnotPanelProps> = ({ knotState, editorState, actions }) => {

  return (
    <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
      <h2
        style={{
          fontSize: 'var(--fs-caption)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-sm)',
        }}
      >
        🧶 Knot Construction
      </h2>
      <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Select disks in sequence to wrap the envelope around them.
        <br />
        <strong>Sequence:</strong> {knotState.diskSequence.length} disks
      </div>

      <div
        style={{
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        <Button
          onClick={actions.addDisk}
          variant="secondary"
          style={{ width: '100%', fontSize: '12px' }}
        >
          + Add Disk
        </Button>
        <Button
          onClick={() => {
            const lastDisk = editorState.diskBlocks[editorState.diskBlocks.length - 1];
            if (lastDisk) actions.deleteBlock(lastDisk.id);
          }}
          variant="secondary"
          style={{
            width: '100%',
            fontSize: '12px',
            borderColor: 'var(--accent-error)',
            color: 'var(--accent-error)',
          }}
          disabled={editorState.diskBlocks.length === 0}
        >
          - Remove Disk
        </Button>
      </div>

      {knotState.diskSequence.length > 2 && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {knotState.diskSequence[0] === knotState.diskSequence[knotState.diskSequence.length - 1]
            ? '✅ Loop Closed'
            : '⚠️ Loop Open (Click the green start disk to close)'}
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <Button
          onClick={() => {
            // Save with frozen path - use envelopePath (closed loop with arcs)
            // NOT knotPath (which is point-to-point without arcs)
            (actions.addSavedKnot as any)(
              knotState.diskSequence,
              knotState.chiralities,
              knotState.anchorSequence,
              knotState.envelopePath.length > 0 ? knotState.envelopePath : knotState.knotPath,
              editorState.envelopeColor,
            );
            knotState.actions.clearSequence();
          }}
          variant="primary"
          style={{ flex: 1 }}
          disabled={knotState.diskSequence.length < 2}
        >
          Save Envelope
        </Button>
        <Button
          onClick={knotState.actions.clearSequence}
          variant="secondary"
          style={{
            width: '80px',
            borderColor: 'var(--accent-error)',
            color: 'var(--accent-error)',
          }}
          disabled={knotState.diskSequence.length === 0}
        >
          Clear
        </Button>
      </div>

      {/* Matrix Viewer in Knot Mode */}
      {editorState.diskBlocks.length > 0 && (
        <div
          style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}
        >
          <ContactMatrixViewer disks={editorState.diskBlocks} />
        </div>
      )}
    </div>
  );
};
