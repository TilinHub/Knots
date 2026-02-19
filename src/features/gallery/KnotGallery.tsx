import React from 'react';

import KnotThumbnail from '../../ui/KnotThumbnail';

// Ejemplos de nudos predefinidos
const SAMPLE_KNOTS = [
  {
    id: 1,
    name: 'Trefoil Knot',
    nodes: [0, 1, 2],
    edges: [[0, 1], [1, 2], [2, 0]] as [number, number][]
  },
  {
    id: 2,
    name: 'Figure-Eight',
    nodes: [0, 1, 2, 3],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0]] as [number, number][]
  },
  {
    id: 3,
    name: 'Complete Graph K4',
    nodes: [0, 1, 2, 3],
    edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] as [number, number][]
  },
  {
    id: 4,
    name: 'Pentagram',
    nodes: [0, 1, 2, 3, 4],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] as [number, number][]
  }
];

interface KnotGalleryProps {
  onSelectKnot?: (knot: typeof SAMPLE_KNOTS[0]) => void;
}

export function KnotGallery({ onSelectKnot }: KnotGalleryProps) {
  const handleKnotClick = (knot: typeof SAMPLE_KNOTS[0]) => {
    onSelectKnot?.(knot);
  };

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{
        fontSize: '32px',
        marginBottom: '10px',
        color: '#333'
      }}>Knot Gallery</h1>
      <p style={{
        fontSize: '16px',
        color: '#666',
        marginBottom: '30px'
      }}>Selecciona un nudo para comenzar a editar</p>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '20px',
        maxWidth: '1200px'
      }}>
        {SAMPLE_KNOTS.map((knot) => (
          <div
            key={knot.id}
            onClick={() => handleKnotClick(knot)}
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{
              width: '100px',
              height: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <KnotThumbnail
                nodes={knot.nodes}
                edges={knot.edges}
                size={100}
              />
            </div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#333',
              margin: 0,
              textAlign: 'center'
            }}>{knot.name}</h3>
            <p style={{
              fontSize: '12px',
              color: '#999',
              margin: 0
            }}>
              {knot.nodes.length} nodos, {knot.edges.length} aristas
            </p>
          </div>
        ))}
        
        {/* Botón para crear nuevo nudo */}
        <div
          onClick={() => handleKnotClick({ id: 0, name: 'Nuevo', nodes: [], edges: [] })}
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            border: '2px dashed #ccc'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{
            width: '100px',
            height: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            color: '#ccc'
          }}>+</div>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#666',
            margin: 0
          }}>Crear Nuevo</h3>
        </div>
      </div>
    </div>
  );
}
