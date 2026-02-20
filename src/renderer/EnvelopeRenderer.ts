/**
 * EnvelopeRenderer - Renderizador avanzado para envolventes CS suaves
 * Dibuja la envolvente con efectos visuales mejorados y animaciones fluidas
 */

import { SmoothCSEnvelope } from '../core/geometry/CSEnvelope';
import type { Point2D } from '../core/types/cs';

export interface EnvelopeRenderOptions {
  fillColor?: string;
  strokeColor?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWidth?: number;
  animated?: boolean;
  glowEffect?: boolean;
  gradientFill?: boolean;
  dashPattern?: number[];
}

export class EnvelopeRenderer {
  private ctx: CanvasRenderingContext2D;
  private envelope: SmoothCSEnvelope;
  private defaultOptions: EnvelopeRenderOptions = {
    fillColor: 'rgb(100, 150, 255)',
    strokeColor: 'rgb(50, 100, 200)',
    fillOpacity: 0.25,
    strokeOpacity: 0.6,
    strokeWidth: 2.5,
    animated: false,
    glowEffect: false,
    gradientFill: false,
    dashPattern: [],
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    envelope: SmoothCSEnvelope,
    options?: Partial<EnvelopeRenderOptions>,
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

    // Relleno con gradiente opcional
    if (opts.gradientFill) {
      this.ctx.fillStyle = this.createGradient(points, opts.fillColor!, opts.fillOpacity!);
    } else {
      this.ctx.fillStyle = this.getRGBAColor(opts.fillColor!, opts.fillOpacity!);
    }
    this.ctx.fill();

    // Borde con patrón de guiones opcional
    if (opts.dashPattern && opts.dashPattern.length > 0) {
      this.ctx.setLineDash(opts.dashPattern);
    }

    this.ctx.strokeStyle = this.getRGBAColor(opts.strokeColor!, opts.strokeOpacity!);
    this.ctx.lineWidth = opts.strokeWidth!;
    this.ctx.lineJoin = 'round'; // Esquinas suaves
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Renderiza con animación pulsante suave
   */
  renderAnimated(time: number, baseOpacity: number = 0.25): void {
    const pulse = Math.sin(time * 0.0015) * 0.5 + 0.5; // 0-1, más lento
    const opacity = baseOpacity + pulse * 0.1;
    const glowIntensity = pulse * 0.3;

    this.render({
      fillOpacity: opacity,
      strokeOpacity: opacity + 0.25,
      glowEffect: true,
      animated: true,
    });

    // Efecto de brillo adicional
    if (glowIntensity > 0.15) {
      this.ctx.save();
      this.ctx.globalAlpha = glowIntensity;
      this.drawEnvelopePath(this.envelope.getEnvelopePoints());
      this.ctx.strokeStyle = this.getRGBAColor(this.defaultOptions.strokeColor!, 0.8);
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Renderiza con efecto de brillo (glow) ajustable
   */
  renderGlow(intensity: number = 1.0): void {
    this.render({
      glowEffect: true,
      fillOpacity: 0.2 * intensity,
      strokeOpacity: 0.5 * intensity,
      gradientFill: true,
    });
  }

  /**
   * Renderiza solo el contorno (sin relleno) con estilo mejorado
   */
  renderOutlineOnly(strokeWidth: number = 2.5, opacity: number = 0.7): void {
    const points = this.envelope.getEnvelopePoints();
    if (points.length < 2) return;

    this.ctx.save();
    this.drawEnvelopePath(points);

    this.ctx.strokeStyle = this.getRGBAColor(this.defaultOptions.strokeColor!, opacity);
    this.ctx.lineWidth = strokeWidth;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Renderiza con efecto de resplandor múltiple (halo) mejorado
   */
  renderHalo(layers: number = 4, maxWidth: number = 12): void {
    const points = this.envelope.getEnvelopePoints();
    if (points.length < 2) return;

    this.ctx.save();

    // Dibuja múltiples capas desde afuera hacia adentro
    for (let i = layers; i > 0; i--) {
      const width = (maxWidth * i) / layers;
      const opacity = 0.08 / i;

      this.drawEnvelopePath(points);
      this.ctx.strokeStyle = this.getRGBAColor(this.defaultOptions.strokeColor!, opacity);
      this.ctx.lineWidth = width;
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }

    this.ctx.restore();

    // Dibuja la envolvente principal encima con gradiente
    this.render({
      gradientFill: true,
      fillOpacity: 0.3,
    });
  }

  /**
   * Renderiza con estilo "neomorfismo" (moderno y sutil)
   */
  renderNeomorphic(): void {
    const points = this.envelope.getEnvelopePoints();
    if (points.length < 2) return;

    this.ctx.save();

    // Sombra exterior
    this.drawEnvelopePath(points);
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetX = 3;
    this.ctx.shadowOffsetY = 3;
    this.ctx.fillStyle = this.getRGBAColor(this.defaultOptions.fillColor!, 0.2);
    this.ctx.fill();

    // Luz interior
    this.ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = -2;
    this.ctx.shadowOffsetY = -2;
    this.ctx.strokeStyle = this.getRGBAColor(this.defaultOptions.strokeColor!, 0.3);
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Renderiza con efecto de "onda" en el borde
   */
  renderWaveEffect(time: number, waveSpeed: number = 0.003): void {
    const points = this.envelope.getEnvelopePoints();
    if (points.length < 2) return;

    this.ctx.save();

    // Relleno base
    this.drawEnvelopePath(points);
    this.ctx.fillStyle = this.getRGBAColor(this.defaultOptions.fillColor!, 0.2);
    this.ctx.fill();

    // Borde con patrón animado
    const dashOffset = (time * waveSpeed) % 20;
    this.ctx.setLineDash([10, 10]);
    this.ctx.lineDashOffset = -dashOffset;
    this.ctx.strokeStyle = this.getRGBAColor(this.defaultOptions.strokeColor!, 0.6);
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Renderiza con efecto de "destello" en puntos clave
   */
  renderWithSparkles(time: number, sparkleCount: number = 8): void {
    const points = this.envelope.getEnvelopePoints();
    if (points.length < 2) return;

    // Renderiza envolvente base
    this.render({
      fillOpacity: 0.2,
      strokeOpacity: 0.5,
      glowEffect: true,
    });

    // Agrega destellos
    this.ctx.save();
    const sparkleInterval = Math.floor(points.length / sparkleCount);

    for (let i = 0; i < points.length; i += sparkleInterval) {
      const point = points[i];
      const phase = (time * 0.005 + i * 0.1) % (2 * Math.PI);
      const sparkleSize = 2 + Math.sin(phase) * 1.5;
      const sparkleOpacity = 0.3 + Math.sin(phase) * 0.3;

      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, sparkleSize, 0, 2 * Math.PI);
      this.ctx.fillStyle = this.getRGBAColor('rgb(255, 255, 255)', sparkleOpacity);
      this.ctx.fill();
    }

    this.ctx.restore();
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
   * Crea un gradiente radial para el relleno
   */
  private createGradient(points: Point2D[], color: string, opacity: number): CanvasGradient {
    // Calcula centro y radio del gradiente
    const bounds = this.getBounds(points);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const radius = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2;

    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

    const rgb = this.extractRGB(color);
    gradient.addColorStop(0, this.getRGBAColor(color, opacity * 1.2));
    gradient.addColorStop(0.5, this.getRGBAColor(color, opacity));
    gradient.addColorStop(1, this.getRGBAColor(color, opacity * 0.5));

    return gradient;
  }

  /**
   * Calcula límites de un conjunto de puntos
   */
  private getBounds(points: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Aplica efecto de brillo usando shadow
   */
  private applyGlowEffect(opts: EnvelopeRenderOptions): void {
    this.ctx.shadowColor = opts.strokeColor!;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }

  /**
   * Convierte color RGB a RGBA con opacidad
   */
  private getRGBAColor(rgb: string, opacity: number): string {
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return `rgba(100, 150, 255, ${opacity})`;

    const [r, g, b] = match.map(Number);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
  }

  /**
   * Extrae valores RGB de una cadena de color
   */
  private extractRGB(rgb: string): { r: number; g: number; b: number } {
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return { r: 100, g: 150, b: 255 };

    const [r, g, b] = match.map(Number);
    return { r, g, b };
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

  /**
   * Obtiene las opciones actuales
   */
  getOptions(): EnvelopeRenderOptions {
    return { ...this.defaultOptions };
  }
}
