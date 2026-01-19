import React from 'react';
import type { CSBlock } from '../../core/types/cs';
import { getCurvePointAtLength } from '../../core/geometry/curveTraversal';
import { getCurveLengthInfo } from '../../core/geometry/arcLength';

interface RollingDiskProps {
  blocks: CSBlock[];
  diskRadius: number;
  speed: number;
  isPlaying: boolean;
  showTrail: boolean;
  centerX: number;
  centerY: number;
}

type Point = { x: number; y: number };

/**
 * Componente que renderiza un disco rodando sobre la curva CS
 * y su trayectoria (roulette/cicloide)
 */
export function RollingDisk({
  blocks,
  diskRadius,
  speed,
  isPlaying,
  showTrail,
  centerX,
  centerY,
}: RollingDiskProps) {
  const [progress, setProgress] = React.useState(0);
  const [trail, setTrail] = React.useState<Point[]>([]);
  const animationRef = React.useRef<number | undefined>(undefined);
  const lastTimeRef = React.useRef<number>(0);

  const lengthInfo = React.useMemo(() => getCurveLengthInfo(blocks), [blocks]);
  const totalLength = lengthInfo.totalLength;

  // Función para convertir coordenadas cartesianas a SVG
  function toSVG(x: number, y: number): [number, number] {
    return [centerX + x, centerY - y];
  }

  // Obtener posición y tangente en el punto actual de la curva
  const currentState = React.useMemo(() => {
    if (totalLength === 0) return null;

    const arcLength = (progress * totalLength) % totalLength;
    const state = getCurvePointAtLength(blocks, arcLength);

    if (!state) return null;

    // Calcular el centro del disco (offset perpendicular hacia arriba)
    const normalX = -state.tangent.y;
    const normalY = state.tangent.x;

    const diskCenterX = state.position.x + normalX * diskRadius;
    const diskCenterY = state.position.y + normalY * diskRadius;

    return {
      contact: state.position,
      diskCenter: { x: diskCenterX, y: diskCenterY },
      tangent: state.tangent,
      angle: Math.atan2(state.tangent.y, state.tangent.x),
    };
  }, [blocks, progress, totalLength, diskRadius]);

  // Animación
  React.useEffect(() => {
    if (!isPlaying || totalLength === 0) {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }

      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Incrementar progreso basado en la velocidad
      setProgress((prev) => {
        const newProgress = prev + (speed * deltaTime) / 1000;
        return newProgress >= 1 ? newProgress - 1 : newProgress;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, speed, totalLength]);

  // Actualizar trail
  React.useEffect(() => {
    if (!showTrail) return;
    if (!currentState) return;

    setTrail((prev) => {
      const newTrail = [...prev, currentState.diskCenter];
      const MAX_LENGTH = 500;
      
      // Si no excede el límite, devolver el array completo
      if (newTrail.length <= MAX_LENGTH) {
        return newTrail;
      }
      
      // Truncar manualmente construyendo un nuevo array
      const result: Point[] = [];
      const startIdx = newTrail.length - MAX_LENGTH;
      for (let i = startIdx; i < newTrail.length; i++) {
        result.push(newTrail[i] as Point);
      }
      return result;
    });
  }, [currentState, showTrail]);

  // Limpiar trail cuando se deshabilita
  React.useEffect(() => {
    if (!showTrail) {
      setTrail([]);
    }
  }, [showTrail]);

  // Reset al cambiar bloques
  React.useEffect(() => {
    setProgress(0);
    setTrail([]);
    lastTimeRef.current = 0;
  }, [blocks]);

  // Early return si no hay estado válido
  if (!currentState || totalLength === 0) return null;

  // Extraer todos los valores necesarios de currentState
  const contactX = currentState.contact.x;
  const contactY = currentState.contact.y;
  const diskCenterX = currentState.diskCenter.x;
  const diskCenterY = currentState.diskCenter.y;
  const tangentX = currentState.tangent.x;
  const tangentY = currentState.tangent.y;

  const [contactSvgX, contactSvgY] = toSVG(contactX, contactY);
  const [diskCenterSvgX, diskCenterSvgY] = toSVG(diskCenterX, diskCenterY);

  // Calcular rotación del disco basada en la distancia recorrida
  const distanceTraveled = progress * totalLength;
  const rotationAngle = (distanceTraveled / diskRadius) * (180 / Math.PI);

  return (
    <g>
      {/* Trayectoria del centro del disco (roulette) */}
      {showTrail && trail.length > 1 && (
        <path
          d={trail
            .map((p, i) => {
              const [x, y] = toSVG(p.x, p.y);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ')}
          stroke="var(--accent-primary)"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
          strokeDasharray="4 4"
        />
      )}

      {/* Radio del disco (línea desde centro a punto de contacto) */}
      <line
        x1={diskCenterSvgX}
        y1={diskCenterSvgY}
        x2={contactSvgX}
        y2={contactSvgY}
        stroke="var(--text-tertiary)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.5"
      />

      {/* Círculo del disco */}
      <circle
        cx={diskCenterSvgX}
        cy={diskCenterSvgY}
        r={diskRadius}
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth="2.5"
        opacity="0.8"
      />

      {/* Centro del disco */}
      <circle
        cx={diskCenterSvgX}
        cy={diskCenterSvgY}
        r="4"
        fill="var(--accent-primary)"
        stroke="white"
        strokeWidth="1.5"
      />

      {/* Punto de contacto */}
      <circle
        cx={contactSvgX}
        cy={contactSvgY}
        r="5"
        fill="var(--accent-error)"
        stroke="white"
        strokeWidth="2"
      />

      {/* Marca visual en el disco para mostrar rotación */}
      <g transform={`rotate(${-rotationAngle} ${diskCenterSvgX} ${diskCenterSvgY})`}>
        <line
          x1={diskCenterSvgX}
          y1={diskCenterSvgY}
          x2={diskCenterSvgX + diskRadius * 0.8}
          y2={diskCenterSvgY}
          stroke="var(--accent-primary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx={diskCenterSvgX + diskRadius * 0.8}
          cy={diskCenterSvgY}
          r="3"
          fill="var(--accent-primary)"
        />
      </g>

      {/* Vector tangente (opcional, para debug) */}
      {false && (
        <line
          x1={contactSvgX}
          y1={contactSvgY}
          x2={contactSvgX + tangentX * 50}
          y2={contactSvgY - tangentY * 50}
          stroke="green"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
      )}
    </g>
  );
}
