/**
 * EnvelopeRenderer - Renderizador para envolventes CS suaves
 * Dibuja la envolvente con efectos visuales y animaciones
 */

import { SmoothCSEnvelope } from '../core/geometry/CSEnvelope';
import { Point2D } from '../core/types/cs';

export interface EnvelopeRenderOptions {
  fillColor?: string;
  strokeColor?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWidth?: number;
  animated?: boolean;
  glowEffect?: boolean;
}

export class EnvelopeRenderer {
  private ctx: CanvasRenderingContext2D;
  private envelope: SmoothCSEnvelope;
  private defaultOptions: EnvelopeRenderOptions = {
    fillColor: 'rgb(100, 150, 255)',
    strokeColor: 'rgb(50, 100, 200)',
    fillOpacity: 0.2,
    strokeOpacity: 0.5,
    strokeWidth: 2,
    animated: false,
    glowEffect: false,
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    envelope: SmoothCSEnvelope,
    options?: Partial<EnvelopeRenderOptions>
  ) {
    this.ctx = ctx;
    this.envelope = envelope;
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Renderiza la envolvente con opciones especificadas
   */
  render(options?: Partial<EnvelopeRenderOptions>): void {
    const opts = { ...this.defaultOptions, ...options };
    const points = this.envelope.getEnvelopePoints();

    if (points.length < 2) return;

    this.ctx.save();

    // Dibuja la envolvente
    this.drawEnvelopePath(points);

    // Aplica efectos
    if (opts.glowEffect) {
      this.applyGlowEffect(opts);
    }

    // Relleno
    this.ctx.fillStyle = this.getRGBAColor(
      opts.fillColor!,
      opts.fillOpacity!
    );
    this.ctx.fill();

    // Borde
    this.ctx.strokeStyle = this.getRGBAColor(
      opts.strokeColor!,
      opts.strokeOpacity!
    );
    this.ctx.lineWidth = opts.strokeWidth!;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Renderiza con animación pulsante
   */
  renderAnimated(time: number, baseOpacity: number = 0.2): void {
    const pulse = Math.sin(time * 0.002) * 0.5 + 0.5; // 0-1
    const opacity = baseOpacity + pulse * 0.15;

    this.render({
      fillOpacity: opacity,
      strokeOpacity: opacity + 0.2,
      animated: true,
    });
  }

  /**
   * Renderiza con efecto de brillo (glow)
   */
  renderGlow(intensity: number = 1.0): void {
    this.render({
      glowEffect: true,
      fillOpacity: 0.15 * intensity,
      strokeOpacity: 0.4 * intensity,
    });
  }

  /**
   * Renderiza solo el contorno (sin relleno)
   */
  renderOutlineOnly(strokeWidth: number = 2, opacity: number = 0.6): void {
    const points = this.envelope.getEnvelopePoints();
    if (points.length < 2) return;

    this.ctx.save();
    this.drawEnvelopePath(points);

    this.ctx.strokeStyle = this.getRGBAColor(
      this.defaultOptions.strokeColor!,
      opacity
    );
    this.ctx.lineWidth = strokeWidth;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Renderiza con efecto de resplandor múltiple (halo)
   */
  renderHalo(layers: number = 3, maxWidth: number = 10): void {
    const points = this.envelope.getEnvelopePoints();
    if (points.length < 2) return;

    this.ctx.save();

    // Dibuja múltiples capas desde afuera hacia adentro
    for (let i = layers; i > 0; i--) {
      const width = (maxWidth * i) / layers;
      const opacity = 0.1 / i;

      this.drawEnvelopePath(points);
      this.ctx.strokeStyle = this.getRGBAColor(
        this.defaultOptions.strokeColor!,
        opacity
      );
      this.ctx.lineWidth = width;
      this.ctx.stroke();
    }

    this.ctx.restore();

    // Dibuja la envolvente principal encima
    this.render();
  }

  /**
   * Dibuja el path de la envolvente
   */
  private drawEnvelopePath(points: Point2D[]): void {
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }

    this.ctx.closePath();
  }

  /**
   * Aplica efecto de brillo usando shadow
   */
  private applyGlowEffect(opts: EnvelopeRenderOptions): void {
    this.ctx.shadowColor = opts.strokeColor!;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }

  /**
   * Convierte color RGB a RGBA con opacidad
   */
  private getRGBAColor(rgb: string, opacity: number): string {
    // Extrae valores RGB
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return `rgba(100, 150, 255, ${opacity})`;

    const [r, g, b] = match.map(Number);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Actualiza el contexto de renderizado
   */
  setContext(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
  }

  /**
   * Actualiza la envolvente
   */
  setEnvelope(envelope: SmoothCSEnvelope): void {
    this.envelope = envelope;
  }

  /**
   * Actualiza opciones por defecto
   */
  setDefaultOptions(options: Partial<EnvelopeRenderOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
}
