# Guía de Uso: Envolvente CS Interactiva

Documentación completa para usar la envolvente suave e interactiva que se ajusta dinámicamente al mover los discos.

## 🎯 Características Principales

- **Suavidad Ultra**: Interpolación spline cúbica Catmull-Rom para transiciones perfectas
- **Interactividad Total**: Se actualiza automáticamente al mover discos
- **Contracción/Expansión**: Se adapta inteligentemente a la distancia entre discos
- **Efectos Visuales**: Múltiples estilos de renderizado (glow, halo, neomorfismo, etc.)
- **Optimizado**: Debouncing y actualizaciones eficientes para 60fps+

## 🚀 Uso Rápido

### Opción 1: Hook Simple (Recomendado)

```typescript
import { useEnvelope } from '@/features/editor/hooks/useInteractiveEnvelope';
import { Circle } from '@/core/geometry/CSEnvelope';

function MyComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [circles, setCircles] = useState<Circle[]>([
    { center: { x: 200, y: 200 }, radius: 50 },
    { center: { x: 400, y: 200 }, radius: 50 },
    { center: { x: 300, y: 350 }, radius: 50 },
  ]);

  // Hook que maneja todo automáticamente
  const envelope = useEnvelope(canvasRef, circles);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      // Limpia canvas
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

      // Dibuja discos
      circles.forEach(circle => {
        ctx.beginPath();
        ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
        ctx.fill();
      });

      // Renderiza envolvente
      envelope.render(Date.now(), true); // true = animado

      requestAnimationFrame(animate);
    };

    animate();
  }, [circles, envelope]);

  // Cuando mueves un disco:
  const handleDiskMove = (index: number, newPosition: { x: number; y: number }) => {
    setCircles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], center: newPosition };
      return updated;
    });
    // ¡La envolvente se actualiza automáticamente!
  };

  return <canvas ref={canvasRef} width={800} height={600} />;
}
```

### Opción 2: Hook con Animación Automática

```typescript
import { useAnimatedEnvelope } from '@/features/editor/hooks/useInteractiveEnvelope';

function MyComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [circles, setCircles] = useState<Circle[]>([...]);
  const [animationEnabled, setAnimationEnabled] = useState(true);

  // Hook con loop de animación integrado
  const envelope = useAnimatedEnvelope(canvasRef, circles, animationEnabled);

  // ¡Eso es todo! La animación corre automáticamente

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={600} />
      <button onClick={() => setAnimationEnabled(!animationEnabled)}>
        {animationEnabled ? 'Pausar' : 'Reproducir'} Animación
      </button>
    </div>
  );
}
```

### Opción 3: Control Completo

```typescript
import { useInteractiveEnvelope } from '@/features/editor/hooks/useInteractiveEnvelope';

function AdvancedComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [circles, setCircles] = useState<Circle[]>([...]);

  const envelope = useInteractiveEnvelope(canvasRef, circles, {
    smoothness: 50,              // 10-100 (más = más suave)
    bezierTension: 0.5,          // 0-1 (tensión de curvas)
    adaptiveSmoothing: true,     // Suavizado adaptativo
    debounceMs: 16,              // Delay para actualizaciones (~60fps)
    renderOptions: {
      fillColor: 'rgb(100, 200, 255)',
      strokeColor: 'rgb(50, 150, 200)',
      fillOpacity: 0.3,
      strokeOpacity: 0.7,
      strokeWidth: 3,
      glowEffect: true,
      gradientFill: true,
    },
  });

  // Actualizar al mover discos
  const handleDiskDrag = (index: number, newPos: Point2D) => {
    const updated = [...circles];
    updated[index].center = newPos;

    // Actualización inmediata (sin debounce) para drag fluido
    envelope.updateCirclesImmediate(updated);
    setCircles(updated);
  };

  // Cambiar suavidad dinámicamente
  const adjustSmoothness = (value: number) => {
    envelope.setSmoothness(value);
  };

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={600} />
      <input
        type="range"
        min="10"
        max="100"
        onChange={(e) => adjustSmoothness(Number(e.target.value))}
      />
    </div>
  );
}
```

## 🎨 Efectos Visuales Disponibles

### Renderizado Básico

```typescript
// Render simple
envelope.render();

// Render con configuración personalizada
envelope.render(Date.now(), true); // animado
```

### Efectos Especiales

```typescript
const { renderer } = envelope;

// Efecto de brillo (glow)
renderer.renderGlow(1.5); // intensidad 0-2

// Solo contorno
renderer.renderOutlineOnly(3, 0.8); // ancho, opacidad

// Efecto halo (múltiples capas)
renderer.renderHalo(5, 15); // capas, ancho máximo

// Estilo neomórfico (moderno)
renderer.renderNeomorphic();

// Efecto de onda animada
renderer.renderWaveEffect(Date.now(), 0.003);

// Destellos en los bordes
renderer.renderWithSparkles(Date.now(), 12); // tiempo, cantidad
```

### Combinando Efectos

```typescript
function renderEnvelopeWithEffects(time: number) {
  const { renderer } = envelope;

  // Capa 1: Halo de fondo
  renderer.renderHalo(4, 12);

  // Capa 2: Envolvente principal animada
  renderer.renderAnimated(time, 0.25);

  // Capa 3: Destellos
  renderer.renderWithSparkles(time, 8);
}
```

## ⚙️ Configuración Avanzada

### Ajustar Suavidad Dinámicamente

```typescript
// Más puntos = más suave (pero más pesado)
envelope.setSmoothness(60); // 10-100

// Tensión de curvas Bézier
envelope.setBezierTension(0.7); // 0-1 (0=recto, 1=muy curvo)

// Activar/desactivar suavizado adaptativo
envelope.setAdaptiveSmoothing(true);
```

### Cambiar Estilo Visual en Tiempo Real

```typescript
envelope.setRenderOptions({
  fillColor: 'rgb(255, 100, 150)',
  strokeColor: 'rgb(200, 50, 100)',
  fillOpacity: 0.4,
  strokeOpacity: 0.8,
  strokeWidth: 4,
  glowEffect: true,
  gradientFill: true,
  dashPattern: [10, 5], // Línea discontinua [segmento, espacio]
});
```

## 💎 Comportamiento al Mover Discos

### Expansión (Separar Discos)

Cuando separas los discos, la envolvente se **expande suavemente** siguiendo las tangentes externas:

```typescript
// Los discos están separados
const circles = [
  { center: { x: 200, y: 200 }, radius: 50 },
  { center: { x: 500, y: 200 }, radius: 50 }, // Lejos
];
// ➡️ Envolvente se expande naturalmente
```

### Contracción (Acercar Discos)

Cuando acercas los discos, la envolvente se **contrae gradualmente** hasta su límite mínimo:

```typescript
// Los discos están muy cerca
const circles = [
  { center: { x: 200, y: 200 }, radius: 50 },
  { center: { x: 250, y: 200 }, radius: 50 }, // Cerca
];
// ➡️ Envolvente se contrae hasta que ya no puede más
```

### Límite Mínimo

La envolvente **no puede contraerse más** cuando:

- Los círculos se tocan o superponen
- La distancia entre centros < suma de radios

```typescript
// Círculos superpuestos
const circles = [
  { center: { x: 200, y: 200 }, radius: 50 },
  { center: { x: 220, y: 200 }, radius: 50 }, // Superpuestos
];
// ➡️ Envolvente usa algoritmo especial de contracción
```

## 🚀 Optimización de Rendimiento

### Uso de Debouncing

```typescript
// Bueno: Actualización con debounce (default)
envelope.updateCircles(newCircles); // Se actualiza después de 16ms

// Mejor para drag: Actualización inmediata
envelope.updateCirclesImmediate(newCircles); // Se actualiza al instante
```

### Configurar Debounce

```typescript
const envelope = useInteractiveEnvelope(canvasRef, circles, {
  debounceMs: 33, // ~30fps (más eficiente)
  // o
  debounceMs: 16, // ~60fps (más fluido)
  // o
  debounceMs: 8, // ~120fps (ultra fluido, más CPU)
});
```

### Reducción de Suavidad para Mejor Rendimiento

```typescript
// Menos puntos = más rápido
envelope.setSmoothness(25); // Bueno para móviles
envelope.setSmoothness(40); // Balance ideal
envelope.setSmoothness(60); // Ultra suave (más pesado)
```

## 📝 Ejemplo Completo: Editor Interactivo

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { useInteractiveEnvelope } from '@/features/editor/hooks/useInteractiveEnvelope';
import { Circle } from '@/core/geometry/CSEnvelope';

function InteractiveEnvelopeEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [circles, setCircles] = useState<Circle[]>([
    { center: { x: 200, y: 200 }, radius: 50, id: '1' },
    { center: { x: 400, y: 200 }, radius: 60, id: '2' },
    { center: { x: 300, y: 350 }, radius: 55, id: '3' },
  ]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [smoothness, setSmoothness] = useState(40);

  const envelope = useInteractiveEnvelope(canvasRef, circles, {
    smoothness,
    adaptiveSmoothing: true,
    renderOptions: {
      glowEffect: true,
      gradientFill: true,
    },
  });

  // Manejo de drag
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Encuentra disco clickeado
    const clicked = circles.find(c => {
      const dx = c.center.x - x;
      const dy = c.center.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= c.radius;
    });

    if (clicked?.id) {
      setDragging(clicked.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCircles(prev => {
      const updated = prev.map(c =>
        c.id === dragging ? { ...c, center: { x, y } } : c
      );

      // Actualización inmediata para drag fluido
      envelope.updateCirclesImmediate(updated);

      return updated;
    });
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  // Renderizado
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

      // Renderiza envolvente primero (fondo)
      envelope.render(Date.now(), true);

      // Renderiza discos encima
      circles.forEach(circle => {
        ctx.beginPath();
        ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(100, 150, 255, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(50, 100, 200, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [circles, envelope]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: '1px solid #ccc', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      <div style={{ marginTop: 20 }}>
        <label>
          Suavidad: {smoothness}
          <input
            type="range"
            min="10"
            max="100"
            value={smoothness}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSmoothness(val);
              envelope.setSmoothness(val);
            }}
          />
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        <p>👆 Arrastra los discos para ver cómo la envolvente se ajusta</p>
        <p>➡️ Separa los discos: la envolvente se <strong>expande</strong></p>
        <p>⬅️ Junta los discos: la envolvente se <strong>contrae</strong></p>
      </div>
    </div>
  );
}

export default InteractiveEnvelopeEditor;
```

## 📚 API Reference

### `SmoothCSEnvelope`

```typescript
class SmoothCSEnvelope {
  constructor(circles: Circle[]);

  // Métodos principales
  calculateEnvelope(): Point2D[];
  updateCircles(circles: Circle[]): void;
  updateCirclesImmediate(circles: Circle[]): void;

  // Configuración
  setSmoothness(value: number): void; // 10-100
  setBezierTension(value: number): void; // 0-1
  setAdaptiveSmoothing(enabled: boolean): void;

  // Getters
  getEnvelopePoints(): Point2D[];
  getCircleCount(): number;
  getCircles(): Circle[];
  isEmpty(): boolean;
}
```

### `EnvelopeRenderer`

```typescript
class EnvelopeRenderer {
  constructor(
    ctx: CanvasRenderingContext2D,
    envelope: SmoothCSEnvelope,
    options?: EnvelopeRenderOptions,
  );

  // Métodos de renderizado
  render(options?: Partial<EnvelopeRenderOptions>): void;
  renderAnimated(time: number, baseOpacity?: number): void;
  renderGlow(intensity?: number): void;
  renderOutlineOnly(strokeWidth?: number, opacity?: number): void;
  renderHalo(layers?: number, maxWidth?: number): void;
  renderNeomorphic(): void;
  renderWaveEffect(time: number, waveSpeed?: number): void;
  renderWithSparkles(time: number, sparkleCount?: number): void;

  // Configuración
  setContext(ctx: CanvasRenderingContext2D): void;
  setEnvelope(envelope: SmoothCSEnvelope): void;
  setDefaultOptions(options: Partial<EnvelopeRenderOptions>): void;
  getOptions(): EnvelopeRenderOptions;
}
```

## ❓ Preguntas Frecuentes

### ¿Cómo hago que la envolvente sea más suave?

```typescript
envelope.setSmoothness(70); // Aumenta el valor (10-100)
envelope.setBezierTension(0.6); // Aumenta tensión (0-1)
```

### ¿Cómo cambio los colores?

```typescript
envelope.setRenderOptions({
  fillColor: 'rgb(255, 100, 200)',
  strokeColor: 'rgb(200, 50, 150)',
});
```

### ¿Cómo optimizo para móviles?

```typescript
const envelope = useInteractiveEnvelope(canvasRef, circles, {
  smoothness: 30, // Reducir
  debounceMs: 33, // ~30fps
  adaptiveSmoothing: false, // Desactivar
});
```

### ¿Cómo desactivo la animación?

```typescript
// En lugar de:
envelope.render(Date.now(), true);

// Usa:
envelope.render(); // Sin animación
```

## 🎉 ¡Listo!

Ahora tienes una envolvente CS completamente interactiva que:

- ✅ Se expande cuando separas los discos
- ✅ Se contrae cuando los juntas
- ✅ Es ultra suave con interpolación spline
- ✅ Tiene efectos visuales espectaculares
- ✅ Está optimizada para 60fps+

¡A crear cosas increíbles! 🚀
