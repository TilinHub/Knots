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
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--space-sm)',
                }}
            >
                Elementos ({blocks.length})
            </h2>

            {blocks.length === 0 ? (
                <div
                    style={{
                        fontSize: 'var(--fs-caption)',
                        color: 'var(--text-tertiary)',
                        textAlign: 'center',
                        padding: 'var(--space-lg)',
                    }}
                >
                    Sin elementos aún
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {blocks.map((block) => {
                        const isSelected = block.id === selectedBlockId;
                        const length = block.kind !== 'disk' ? blockLength(block) : null;
                        const displayName =
                            block.kind === 'segment'
                                ? 'Segmento'
                                : block.kind === 'arc'
                                    ? 'Arco'
                                    : block.kind === 'disk'
                                        ? 'Disco'
                                        : 'Elemento';

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
                                            {length.toFixed(1)} px
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
                                                        label="Centro"
                                                        x={block.center.x}
                                                        y={block.center.y}
                                                        onChange={(newX, newY) => onUpdateBlock(block.id, { center: { x: newX, y: newY } })}
                                                    />
                                                </div>
                                                <div style={{ marginTop: '4px' }}>
                                                    <label style={{
                                                        fontSize: 'var(--fs-caption)',
                                                        color: 'var(--text-secondary)',
                                                        fontWeight: 'var(--fw-medium)',
                                                        textTransform: 'uppercase',
                                                        display: 'block',
                                                        marginBottom: '4px'
                                                    }}>
                                                        Radio
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
                                                            background: 'white'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <Button
                                            onClick={() => onDeleteBlock(block.id)}
                                            variant="secondary"
                                            style={{ width: '100%', color: 'var(--accent-error)', borderColor: 'var(--border)' }}
                                        >
                                            Eliminar
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
