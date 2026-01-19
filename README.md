# 🪢 Knots - CS Diagram Builder

**Knots** es un editor interactivo de diagramas CS (Curvature-Segment) para visualizar y analizar curvas compuestas por segmentos lineales y arcos circulares.

🌐 **Demo en vivo**: [https://tilinhub.github.io/Knots/](https://tilinhub.github.io/Knots/)

---

## ✨ Características

### 📐 Editor de Curvas CS
- **Segmentos lineales**: Define puntos inicial y final con coordenadas cartesianas
- **Arcos circulares**: Configura centro, radio y ángulos de inicio/fin
- **Sistema de coordenadas cartesiano**: Origen centrado con ejes X e Y visibles
- **Grilla ajustable**: Control de visibilidad y espaciado
- **Snap a grilla**: Los puntos se ajustan automáticamente cada 5px
- **Radio geométrico separado**: Los cálculos geométricos usan radio 1 mientras que la visualización puede usar cualquier tamaño

### ✅ Validación de Continuidad
- Verifica que los bloques estén conectados correctamente
- Detecta discontinuidades entre segmentos y arcos
- Calcula longitud total de la curva
- Muestra longitud individual de cada bloque

### 🎪 Rolling Mode (Modo Rodante)
**¡NUEVA FUNCIONALIDAD!** Visualiza un disco rodando sobre tu curva CS:

- **Animación de disco**: Observa un círculo rodando a lo largo de la curva
- **Trayectoria del centro**: Visualiza la cicloide/roulette generada
- **Controles interactivos**:
  - ▶️ Play/Pause de la animación
  - 📏 Ajuste de radio del disco (10-80px)
  - ⚡ Control de velocidad (0.05x - 0.5x)
  - 👁️ Toggle de visualización de trayectoria
- **Rotación realista**: El disco rota de acuerdo a la distancia recorrida
- **Punto de contacto**: Marca roja muestra dónde el disco toca la curva

### 🎨 Interfaz Intuitiva
- **Drag & drop**: Arrastra puntos de control directamente en el canvas
- **Panel de propiedades**: Edición numérica precisa de coordenadas y ángulos
- **Unidades flexibles**: Cambia entre grados y radianes
- **Sidebar colapsable**: Maximiza el espacio de trabajo
- **Detección de cruces**: Identifica automáticamente intersecciones en la curva

---

## 🚀 Uso

### 1. Crear una Curva

1. **Añadir bloques**:
   - Haz clic en `+ Segmento` para agregar una línea recta
   - Haz clic en `+ Arco` para agregar un arco circular

2. **Editar visualmente**:
   - Selecciona un bloque haciendo clic sobre él
   - Arrastra los puntos de control (círculos) para modificar la forma

3. **Editar con precisión**:
   - Usa el panel de propiedades en el sidebar
   - Ingresa valores exactos para coordenadas, radios y ángulos

### 2. Validar Continuidad

1. Construye tu curva conectando varios bloques
2. Haz clic en el indicador de estado en el header
3. Revisa errores y advertencias de continuidad
4. Verifica la longitud total de la curva

### 3. Activar Rolling Mode

**Requisito**: La curva debe ser válida (bloques continuos)

1. Haz clic en el botón **🎡 Rolling Mode** en el header
2. Ajusta los controles en el sidebar:
   - **Radio del disco**: Tamaño del círculo rodante
   - **Velocidad**: Qué tan rápido se mueve el disco
   - **Mostrar trayectoria**: Toggle para ver/ocultar la roulette
3. Presiona **▶️ Iniciar** para comenzar la animación
4. Observa:
   - El disco azul rodando sobre la curva
   - El punto rojo de contacto
   - La trayectoria punteada del centro del disco
   - La rotación del disco (marca con punto)

---

## 🧮 Conceptos Matemáticos

### Diagrama CS (Curvature-Segment)
Un diagrama CS es una representación de curvas suaves mediante:
- **Segmentos (S)**: Líneas rectas con curvatura κ = 0
- **Arcos (C)**: Arcos circulares con curvatura κ = 1/r

### Radio Geométrico vs Visual

**IMPORTANTE**: El proyecto separa dos conceptos de radio:

- **`radius`** (Radio geométrico): Usado en todos los cálculos geométricos (hull, distancias, intersecciones). Se recomienda usar **radio = 1** para mantener la pureza matemática.

- **`visualRadius`** (Radio visual): Usado exclusivamente para el renderizado SVG. Puede ser cualquier valor grande (ej. 25) para que los círculos se vean bien en pantalla.

Esta separación permite:
- Cálculos geométricos precisos con radio unitario
- Visualización clara con círculos de tamaño apropiado
- Escalar la visualización sin afectar la geometría subyacente

**Ejemplo de uso**:
```typescript
const scene: Scene = {
  points: [...],
  primitives: [...],
  radius: 1,           // Para cálculos geométricos
  visualRadius: 25     // Para visualización
};
```

### Continuidad
Para que una curva CS sea válida, debe cumplir:
- **C⁰ continuidad**: El punto final de cada bloque debe coincidir con el inicio del siguiente
- **Tolerancia**: ε < 0.01 px (punto flotante)

### Longitud de Curva
- **Segmento**: `L = √((x₂-x₁)² + (y₂-y₁)²)`
- **Arco**: `L = r × |θ₂ - θ₁|`
- **Curva total**: `L_total = Σ L_i`

### Roulette (Trayectoria del Rolling Mode)
Cuando un círculo de radio **r** rueda sobre una curva, el centro del círculo describe una curva llamada **roulette** o **cicloide generalizada**. Esta trayectoria es perpendicular a la curva original a una distancia **r**.

**Matemáticamente**:
- Punto de contacto: `P(s)` en la curva a longitud de arco `s`
- Tangente unitaria: `T(s) = dP/ds`
- Normal unitaria: `N(s) = (-T_y, T_x)`
- Centro del disco: `C(s) = P(s) + r·N(s)`

---

## 🛠️ Tecnologías

- **React 18** con TypeScript
- **Vite** como build tool
- **SVG** para renderizado del canvas
- **requestAnimationFrame** para animaciones suaves
- **CSS Variables** para theming

---

## 📦 Estructura del Proyecto

```
src/
├── core/
│   ├── types/
│   │   └── cs.ts              # Tipos de bloques CS
│   ├── model/
│   │   └── entities.ts        # Tipos Scene, Point, Primitive (con radius y visualRadius)
│   ├── geometry/
│   │   ├── arcLength.ts       # Cálculo de longitudes
│   │   ├── diskHull.ts        # Cálculo de envolvente de discos
│   │   ├── intersections.ts   # Detección de cruces
│   │   └── curveTraversal.ts  # Recorrido de curva para rolling mode
│   └── validation/
│       └── continuity.ts      # Validación de continuidad
├── features/
│   └── editor/
│       ├── EditorPage.tsx     # Página principal del editor
│       ├── CSCanvas.tsx       # Canvas SVG interactivo
│       └── RollingDisk.tsx    # Componente de disco rodante
├── renderer/
│   └── svg/
│       └── SvgStage.tsx       # Renderizador SVG con soporte para visualRadius
├── ui/
│   ├── Button.tsx
│   └── CoordInput.tsx
└── styles/
    └── global.css             # Variables CSS y estilos globales
```

---

## 🎯 Roadmap

- [x] Editor básico de segmentos y arcos
- [x] Validación de continuidad
- [x] Cálculo de longitud de curva
- [x] Detección de intersecciones
- [x] **Rolling Mode con animación**
- [x] **Separación de radio geométrico y visual**
- [ ] Exportar curva como SVG/PNG
- [ ] Guardar/cargar proyectos (JSON)
- [ ] Modo de edición de curvatura (κ-diagram)
- [ ] Análisis de segunda derivada (transición de curvatura)
- [ ] Generación de curvas Bézier equivalentes

---

## 👨‍💻 Desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

---

## 📄 Licencia

MIT License - Siente libre de usar este proyecto para aprender o construir sobre él.

---

## 🙏 Inspiración

Este proyecto fue inspirado por el trabajo de [Fhv75/penny-graphs-viewer](https://github.com/Fhv75/penny-graphs-viewer) y herramientas de diseño de curvas geométricas.

---

**Hecho con ❤️ por [TilinHub](https://github.com/TilinHub)**
