import React from 'react';
import type { ContactDisk, Region } from '../../core/types/contactGraph';

interface ContactDisksProps {
  regions: Region[];
  centerX: number;
  centerY: number;
  onDiskClick?: (disk: ContactDisk) => void;
  selectedDiskId?: string;
  showRegionBoundaries?: boolean;
}

/**
 * Componente para renderizar discos de contacto en regiones
 */
export function ContactDisks({
  regions,
  centerX,
  centerY,
  onDiskClick,
  selectedDiskId,
  showRegionBoundaries = false,
}: ContactDisksProps) {
  // Convertir coordenadas cartesianas a SVG
  function toSVG(x: number, y: number): [number, number] {
    return [centerX + x, centerY - y];
  }

  return (
    <g>
      {/* Renderizar boundaries de regiones (opcional) */}
      {showRegionBoundaries && regions.map(region => {
        const pathData = region.boundary.map((p, i) => {
          const [x, y] = toSVG(p.x, p.y);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ') + ' Z';

        return (
          <path
            key={`boundary-${region.id}`}
            d={pathData}
            fill="none"
            stroke="rgba(150, 150, 255, 0.3)"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
        );
      })}

      {/* Renderizar discos en cada región */}
      {regions.map(region => (
        <g key={`region-${region.id}`}>
          {region.disks.map(disk => {
            const [cx, cy] = toSVG(disk.center.x, disk.center.y);
            const isSelected = selectedDiskId === disk.id;

            return (
              <g key={disk.id}>
                {/* Disco */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={disk.radius}
                  fill={disk.color || 'rgba(100, 150, 255, 0.4)'}
                  stroke={isSelected ? 'rgba(255, 100, 100, 0.8)' : 'rgba(50, 100, 200, 0.6)'}
                  strokeWidth={isSelected ? 3 : 2}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onDiskClick?.(disk)}
                />
                
                {/* Label del disco */}
                <text
                  x={cx}
                  y={cy}
                  fontSize="10"
                  fill="white"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight="600"
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {disk.id.split('-')[1]}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      {/* Renderizar líneas de contacto entre discos */}
      {regions.flatMap(region => {
        const contacts: JSX.Element[] = [];
        
        // Detectar contactos entre discos de la misma región
        for (let i = 0; i < region.disks.length; i++) {
          for (let j = i + 1; j < region.disks.length; j++) {
            const disk1 = region.disks[i];
            const disk2 = region.disks[j];
            
            // Calcular distancia entre centros
            const dx = disk2.center.x - disk1.center.x;
            const dy = disk2.center.y - disk1.center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Si los discos se tocan (distancia ≈ suma de radios)
            const touchThreshold = 2; // px de tolerancia
            if (Math.abs(distance - (disk1.radius + disk2.radius)) < touchThreshold) {
              const [x1, y1] = toSVG(disk1.center.x, disk1.center.y);
              const [x2, y2] = toSVG(disk2.center.x, disk2.center.y);
              
              contacts.push(
                <line
                  key={`contact-${disk1.id}-${disk2.id}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255, 100, 100, 0.5)"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                />
              );
            }
          }
        }
        
        return contacts;
      })}
    </g>
  );
}
