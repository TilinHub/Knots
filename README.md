# 🪢 Knots - Contact Graph & CS Diagram Builder

**Knots** es una herramienta interactiva avanzada para la visualización, análisis y construcción de **Grafos de Contacto**, **Diagramas CS** y trayectorias de **Dubins** en entornos restringidos. Diseñado para investigación matemática y exploración topológica.

🌐 **Demo en vivo**: [https://tilinhub.github.io/Knots/](https://tilinhub.github.io/Knots/)

---

## ✨ Características Principales

### 🔵 Grafos de Contacto y Matrices
- **Construcción de Grafos**: Visualiza discos de contacto que representan regiones vacías en un diagrama de nudo.
- **Matriz de Contacto**:
    - Cálculo en tiempo real de la **Matriz de Adyacencia** (N x N).
    - Visualización interactiva (`1` = contacto, `0` = separado).
    - Actualización dinámica durante el movimiento o rodadura de discos.
    - Exportación rápida al portapapeles.

### 🎢 Rolling Mode Interactiva
Simula la rodadura de un disco a lo largo del "envelope" formado por otros discos:
- **Envolvente Dinámica**: El cinturón convexo (Convex Hull) se recalcula y ajusta en tiempo real mientras el disco rueda.
- **Feedback Inmediato**: La matriz de contacto se actualiza instantáneamente para reflejar los cambios de topología al rodar.
- **Controles Precisos**: Ajuste de ángulo, velocidad y dirección de rodadura.
- **Visualización de Trayectoria**: Traza la cicloide/roulette generada por el centro del disco.

### 🚗 Trayectorias de Dubins en Grafos
- **Cálculo de Caminos**: Encuentra caminos óptimos (tangentes bitangentes) entre discos.
- **Desglose de Longitud**:
    - **Total**: Suma exacta de segmentos y arcos.
    - **Rectas**: Longitud de los tramos rectos tangenciales.
    - **Arcos**: Longitud de los tramos curvos sobre los discos.
- **Navegación**: Sistema robusto para moverse entre configuraciones a través del grafo de contacto.

### 📐 Editor de Precisión
- **Unidades Lógicas**: Sistema de coordenadas escalado donde **50px = 1 unidad lógica (u)**.
    - *Ejemplo*: Un disco de radio 50px se muestra como radio `1.00 u`.
- **Información Detallada**:
    - Visualización de coordenadas centros `(x, y)` en unidades lógicas.
    - Longitudes de arco y cuerda precisas.
- **Herramientas de Dibujo**:
    - Segmentos, Arcos y Discos.
    - Validación de continuidad geométrica (C0).
    - Detección de intersecciones.

---

## 🚀 Guía Rápida

### 1. Grafos de Contacto
1. Activa **"🔵 Grafos de Contacto"** en la barra superior.
2. Añade discos usando el botón `+ Disco` o utiliza la **Galería de Grafos** predefinidos.
3. Observa la **Matriz de Contacto** en el panel lateral, que muestra qué discos se tocan.

### 2. Rolling Mode
1. Selecciona **"🎡 Rolling Mode"**.
2. Elige un **Pivote** (disco de soporte) y un **Rodante** (disco que se mueve).
3. Usa los controles para rodar el disco.
4. Nota como la curva azul claro (**Envolvente**) se estira y adapta para envolver la nueva configuración dinámicamente.

### 3. Editor Manual
- **Arrastrar**: Mueve discos y puntos de control libremente.
- **Panel Lateral**: Edita coordenadas numéricas exactas si necesitas precisión matemática.
- **Matriz en Edición**: La matriz de contacto también es visible al editar manualmente para guiarte en la colocación de discos tangentes.

---

## 🧮 Conceptos Técnicos

### Escala de Unidades
Para facilitar la visualización matemática sin perder fidelidad en pantalla:
- **Factor de Escala**: `50 píxeles = 1 unidad`.
- Todas las etiquetas de longitud (L), coordenadas (x,y) y radios se muestran en estas **unidades lógicas (u)**.

### Matriz de Adyacencia
La aplicación calcula una matriz simétrica $A$ donde:
$$A_{ij} = \begin{cases} 1 & \text{si } d(C_i, C_j) \approx R_i + R_j \\ 0 & \text{en otro caso} \end{cases}$$
Utiliza una tolerancia ajustada para manejar la precisión de punto flotante en la interacción visual.

---

## 🛠️ Tecnologías

- **React 18** + **TypeScript**: Core de la aplicación.
- **SVG Interactiva**: Motor de renderizado vectorial de alto rendimiento.
- **Algoritmos Geométricos**: Implementación personalizada para *Convex Hulls*, *Dubins Paths* y *Contact Graphs*.

---

## 📦 Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build
```

---

**Licencia MIT** - Desarrollado por [TilinHub](https://github.com/TilinHub)
