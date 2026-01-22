# Guia de Uso: Componente de Envolvente Flexible

## Resumen

El componente `FlexibleEnvelope` proporciona una envolvente dinamica y suave que envuelve a discos en un canvas interactivo. La envolvente se adapta automaticamente cuando los discos se mueven, utilizando el algoritmo Graham Scan para calcular el convex hull y curvas Bezier para suavizarla.

## Caracteristicas

- **Envolvente Dinamica**: Se recalcula en tiempo real cuando los discos se mueven
- **Suavidad**: Utiliza curvas Bezier quadraticas para crear una envolvente suave y visualmente agradable
- **Interactiva**: Los discos pueden arrastrarse con el mouse
- **Flexible**: Se contrae y agranda automaticamente segun los discos contenidos
- **Graham Scan**: Calcula el convex hull optimo de los discos

## Uso Basico

```typescript
import { FlexibleEnvelope } from './src/FlexibleEnvelope';

const MyComponent = () => {
  const disks = [
    { id: 'disk1', center: { x: 100, y: 100 }, radius: 30 },
    { id: 'disk2', center: { x: 250, y: 150 }, radius: 40 },
    { id: 'disk3', center: { x: 200, y: 300 }, radius: 35 }
  ];

  const handleDiskDrag = (diskId: string, newPos: { x: number; y: number }) => {
    console.log(`Disco ${diskId} movido a`, newPos);
  };

  return (
    <FlexibleEnvelope
      disks={disks}
      width={800}
      height={600}
      onDiskDrag={handleDiskDrag}
    />
  );
};
```

## Props

| Prop | Tipo | Descripcion |
|------|------|-------------|
| `disks` | `Disk[]` | Array de discos a envolver. Cada disco debe tener id, center (x,y) y radius |
| `width` | `number` | Ancho del canvas en pixeles |
| `height` | `number` | Alto del canvas en pixeles |
| `onDiskDrag` | `(diskId: string, newPos: {x, y}) => void` | Callback opcional cuando se arrastra un disco |

## Algoritmo de Envolvente

### 1. Generacion de Puntos

Para cada disco, se generan 32 puntos alrededor de su circunferencia:

```
punto = (centro.x + radio_expandido * cos(angulo), centro.y + radio_expandido * sin(angulo))
```

Donde `radio_expandido = radio + 10` pixeles para dar espacio visual.

### 2. Graham Scan (Convex Hull)

Esta es la implementacion del algoritmo Graham Scan:

1. Encontrar el punto mas bajo y mas a la izquierda
2. Ordenar todos los puntos por angulo polar respecto a ese punto
3. Construir el convex hull recorriendo los puntos ordenados
4. Descartar puntos que crean un giro a la derecha (producto cruz negativo)

### 3. Suavizacion con Curvas Bezier

La envolvente se suaviza conectando puntos adyacentes del convex hull con curvas Bezier quadraticas:

```
curvaBezier(p1, p1, (p1+p2)/2)
```

Esto crea una envolvente suave y continua.

## Ejemplo Interactivo

```typescript
import React, { useState } from 'react';
import FlexibleEnvelope from './src/FlexibleEnvelope';

interface Disk {
  id: string;
  center: { x: number; y: number };
  radius: number;
}

export const DemoEnvelope = () => {
  const [disks, setDisks] = useState<Disk[]>([
    { id: 'A', center: { x: 150, y: 150 }, radius: 30 },
    { id: 'B', center: { x: 350, y: 200 }, radius: 40 },
    { id: 'C', center: { x: 250, y: 400 }, radius: 35 },
    { id: 'D', center: { x: 450, y: 350 }, radius: 25 }
  ]);

  const handleDiskDrag = (diskId: string, newPos: { x: number; y: number }) => {
    setDisks(disks.map(disk => 
      disk.id === diskId ? { ...disk, center: newPos } : disk
    ));
  };

  return (
    <div>
      <h1>Envolvente Flexible Demo</h1>
      <FlexibleEnvelope
        disks={disks}
        width={800}
        height={600}
        onDiskDrag={handleDiskDrag}
      />
      <p>Arrastra los discos para ver como la envolvente se adapta dinamicamente.</p>
    </div>
  );
};
```

## Rendimiento

- **Tiempo de calculo**: O(n log n) donde n es el numero de discos (Graham Scan)
- **Actualizacion en tiempo real**: Se redibuja en cada movimiento del mouse
- **Optimizacion recomendada**: Para >100 discos, considere usar Web Workers

## Integracion con Nudos

En el contexto de visualizacion de nudos, la envolvente flexible puede usarse para:

1. **Envolvente de Discos de Contacto**: Visualizar la envoltura de los discos que representan regiones
2. **Representacion Suave del Nudo**: La envolvente sirve como proyeccion planar suave del nudo
3. **Interaccion**: Permite modificar la configuracion de discos y ver como afecta la topologia

## Notas Tecnicas

- El algoritmo Graham Scan asume puntos en posicion general (sin tres colineal en el mismo orden)
- La expansion del radio (10 pixeles) es configurable modificando `calculateEnvelope`
- Las curvas Bezier usa `quadraticCurveTo` del contexto 2D
- El componente maneja automata el estado de los discos internamente
