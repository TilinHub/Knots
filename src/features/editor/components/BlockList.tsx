import type { CSBlock } from '../../../core/types/cs';
import { blockLength } from '../../../core/geometry/arcLength';
import { CoordInput } from '../../../ui/CoordInput';
import { Button } from '../../../ui/Button';

export interface BlockListProps {
    blocks: CSBlock[];
    selectedBlockId: string | null;
    onSelectBlock: (id: string) => void;
    onUpdateBlock: (id: string, updates: Partial<CSBlock>) => void;
    onDeleteBlock: (id: string) => void;
}

export const BlockList = ({
    blocks,
    selectedBlockId,
    onSelectBlock,
    onUpdateBlock,
    onDeleteBlock,
}: BlockListProps) => {
    return (
        <div
            style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
                flex: 1,
                overflowY: 'auto',
            }}
        >
            <h2
                style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--space-sm)',
                }}
            >
                Elements ({blocks.length})
            </h2>

            {blocks.length === 0 ? (
                <div
                    style={{
                        fontSize: '13px',
                        color: 'var(--text-tertiary)',
                        textAlign: 'center',
                        padding: 'var(--space-lg)',
                    }}
                >
                    No elements yet
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {blocks.map((block) => {
                        const isSelected = block.id === selectedBlockId;
                        const length = block.kind !== 'disk' ? blockLength(block) : null;
                        const displayName =
                            block.kind === 'segment'
                                ? 'Segment'
                                : block.kind === 'arc'
                                    ? 'Arc'
                                    : block.kind === 'disk'
                                        ? 'Disk'
                                        : 'Element';

                        return (
                            <div
                                key={block.id}
                                onClick={() => onSelectBlock(block.id)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '6px',
                                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                                    border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s, border-color 0.15s',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: isSelected ? 'var(--fw-medium)' : 'normal', color: 'var(--text-primary)' }}>
                                        {displayName}
                                    </span>
                                    {length !== null && (
                                        <span style={{ fontSize: 'var(--fs-caption)', fontFamily: 'var(--ff-mono)', color: 'var(--text-secondary)' }}>
                                            {(length / 50).toFixed(2)} u
                                        </span>
                                    )}
                                </div>

                                {isSelected && (
                                    <div style={{ marginTop: '12px', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                                        {/* Placeholder for CoordInput if needed in future */}
                                        {block.kind === 'disk' && (
                                            <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <CoordInput
                                                        label="Center"
                                                        x={block.center.x / 50}
                                                        y={block.center.y / 50}
                                                        onChange={(newX, newY) => onUpdateBlock(block.id, { center: { x: newX * 50, y: newY * 50 } })}
                                                    />
                                                </div>
                                                <div style={{ marginTop: '4px' }}>
                                                    <label style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-secondary)',
                                                        fontWeight: 500,
                                                        textTransform: 'uppercase',
                                                        display: 'block',
                                                        marginBottom: '4px'
                                                    }}>
                                                        Radius
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={block.radius}
                                                        onChange={(e) => onUpdateBlock(block.id, { radius: Number(e.target.value) })}
                                                        style={{
                                                            width: '100%',
                                                            height: '32px',
                                                            padding: '0 8px',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px',
                                                            fontFamily: 'var(--ff-mono)',
                                                            background: 'var(--bg-primary)',
                                                            color: 'var(--text-primary)',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <Button
                                            onClick={() => onDeleteBlock(block.id)}
                                            variant="secondary"
                                            style={{ width: '100%', color: '#FF3B30', borderColor: 'rgba(255, 59, 48, 0.2)' }}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
