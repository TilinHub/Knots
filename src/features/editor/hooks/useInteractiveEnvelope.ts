import { useCallback, useEffect, useMemo, useRef } from 'react';

import { type Circle, SmoothCSEnvelope } from '../../../core/geometry/CSEnvelope';
import type { Point2D } from '../../../core/types/cs';
import { EnvelopeRenderer, type EnvelopeRenderOptions } from '../../../renderer/EnvelopeRenderer';

interface UseInteractiveEnvelopeOptions {
  smoothness?: number;
  bezierTension?: number;
  adaptiveSmoothing?: boolean;
  renderOptions?: Partial<EnvelopeRenderOptions>;
  debounceMs?: number;
  autoUpdate?: boolean;
}

interface UseInteractiveEnvelopeReturn {
  envelope: SmoothCSEnvelope | null;
  renderer: EnvelopeRenderer | null;
  updateCircles: (circles: Circle[]) => void;
  updateCirclesImmediate: (circles: Circle[]) => void;
  render: (time?: number, animated?: boolean) => void;
  getEnvelopePoints: () => Point2D[];
  setSmoothness: (value: number) => void;
  setBezierTension: (value: number) => void;
  setAdaptiveSmoothing: (enabled: boolean) => void;
  setRenderOptions: (options: Partial<EnvelopeRenderOptions>) => void;
}

/**
 * Hook para manejar envolvente interactiva con actualización en tiempo real
 */
export function useInteractiveEnvelope(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  initialCircles: Circle[] = [],
  options: UseInteractiveEnvelopeOptions = {},
): UseInteractiveEnvelopeReturn {
  const {
    smoothness = 40,
    bezierTension = 0.5,
    adaptiveSmoothing = true,
    renderOptions = {},
    debounceMs = 16, // ~60fps
    autoUpdate = true,
  } = options;

  const envelopeRef = useRef<SmoothCSEnvelope | null>(null);
  const rendererRef = useRef<EnvelopeRenderer | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCirclesRef = useRef<Circle[]>(initialCircles);

  // Inicializa envolvente
  useEffect(() => {
    if (!envelopeRef.current) {
      const envelope = new SmoothCSEnvelope(initialCircles);
      envelope.setSmoothness(smoothness);
      envelope.setBezierTension(bezierTension);
      envelope.setAdaptiveSmoothing(adaptiveSmoothing);
      envelopeRef.current = envelope;
    }
  }, []);

  // Inicializa renderer cuando el canvas está disponible
  useEffect(() => {
    if (!canvasRef.current || !envelopeRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (!rendererRef.current) {
      rendererRef.current = new EnvelopeRenderer(ctx, envelopeRef.current, renderOptions);
    } else {
      rendererRef.current.setContext(ctx);
      rendererRef.current.setEnvelope(envelopeRef.current);
    }
  }, [canvasRef.current, renderOptions]);

  /**
   * Actualiza círculos con debouncing para mejor rendimiento
   */
  const updateCircles = useCallback(
    (circles: Circle[]) => {
      if (!envelopeRef.current) return;

      lastCirclesRef.current = circles;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (envelopeRef.current) {
          envelopeRef.current.updateCircles(circles);
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  /**
   * Actualiza círculos inmediatamente sin debouncing
   * Usar para animaciones fluidas
   */
  const updateCirclesImmediate = useCallback((circles: Circle[]) => {
    if (!envelopeRef.current) return;

    lastCirclesRef.current = circles;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    envelopeRef.current.updateCirclesImmediate(circles);
  }, []);

  /**
   * Renderiza la envolvente
   */
  const render = useCallback((time?: number, animated: boolean = false) => {
    if (!rendererRef.current || !envelopeRef.current) return;
    if (envelopeRef.current.isEmpty()) return;

    if (animated && time !== undefined) {
      rendererRef.current.renderAnimated(time);
    } else {
      rendererRef.current.render();
    }
  }, []);

  /**
   * Obtiene puntos de la envolvente
   */
  const getEnvelopePoints = useCallback((): Point2D[] => {
    return envelopeRef.current?.getEnvelopePoints() || [];
  }, []);

  /**
   * Ajusta suavidad
   */
  const setSmoothness = useCallback((value: number) => {
    envelopeRef.current?.setSmoothness(value);
  }, []);

  /**
   * Ajusta tensión de Bézier
   */
  const setBezierTension = useCallback((value: number) => {
    envelopeRef.current?.setBezierTension(value);
  }, []);

  /**
   * Activa/desactiva suavizado adaptativo
   */
  const setAdaptiveSmoothing = useCallback((enabled: boolean) => {
    envelopeRef.current?.setAdaptiveSmoothing(enabled);
  }, []);

  /**
   * Actualiza opciones de renderizado
   */
  const setRenderOptions = useCallback((options: Partial<EnvelopeRenderOptions>) => {
    rendererRef.current?.setDefaultOptions(options);
  }, []);

  // Limpieza
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    envelope: envelopeRef.current,
    renderer: rendererRef.current,
    updateCircles,
    updateCirclesImmediate,
    render,
    getEnvelopePoints,
    setSmoothness,
    setBezierTension,
    setAdaptiveSmoothing,
    setRenderOptions,
  };
}

/**
 * Hook simplificado para uso básico
 */
export function useEnvelope(canvasRef: React.RefObject<HTMLCanvasElement>, circles: Circle[]) {
  const envelope = useInteractiveEnvelope(canvasRef, circles, {
    smoothness: 40,
    adaptiveSmoothing: true,
    autoUpdate: true,
  });

  // Auto-actualiza cuando cambian los círculos
  useEffect(() => {
    envelope.updateCircles(circles);
  }, [circles]);

  return envelope;
}

/**
 * Hook para envolvente con animación automática
 */
export function useAnimatedEnvelope(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  circles: Circle[],
  enabled: boolean = true,
) {
  const envelope = useInteractiveEnvelope(canvasRef, circles, {
    smoothness: 50,
    adaptiveSmoothing: true,
    renderOptions: {
      animated: true,
      glowEffect: true,
      gradientFill: true,
    },
  });

  const animationFrameRef = useRef<number | null>(null);

  // Auto-actualiza círculos
  useEffect(() => {
    envelope.updateCirclesImmediate(circles);
  }, [circles]);

  // Loop de animación
  useEffect(() => {
    if (!enabled) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = () => {
      envelope.render(Date.now(), true);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, envelope]);

  return envelope;
}
