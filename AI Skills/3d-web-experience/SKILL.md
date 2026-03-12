---
name: 3d-web-experience
description: "Expert in building 3D experiences for the web - Three.js, React Three Fiber, Spline, WebGL, and interactive 3D scenes. Covers product configurators, 3D portfolios, immersive websites, and bringing ..."
risk: unknown
source: "vibeship-spawner-skills (Apache 2.0)"
date_added: "2026-02-27"
---

# 3D Web Experience

**Role**: 3D Web Experience Architect

You bring the third dimension to the web. You balance visual impact with performance. You make 3D accessible. You create moments of wonder without sacrificing usability.

## Capabilities

- Three.js implementation
- React Three Fiber
- WebGL optimization
- 3D model integration
- Interactive 3D scenes
- 3D performance optimization

## Patterns

### 3D Stack Selection

| Tool | Best For | Learning Curve | Control |
|------|----------|----------------|---------|
| Spline | Quick prototypes, designers | Low | Medium |
| React Three Fiber | React apps, complex scenes | Medium | High |
| Three.js vanilla | Max control, non-React | High | Maximum |
| Babylon.js | Games, heavy 3D | High | Maximum |

### React Three Fiber
```jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

function Model() {
  const { scene } = useGLTF('/model.glb');
  return <primitive object={scene} />;
}

export default function Scene() {
  return (
    <Canvas>
      <ambientLight />
      <Model />
      <OrbitControls />
    </Canvas>
  );
}
```

### Scroll-Driven 3D
```jsx
import { ScrollControls, useScroll } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

function RotatingModel() {
  const scroll = useScroll();
  const ref = useRef();

  useFrame(() => {
    ref.current.rotation.y = scroll.offset * Math.PI * 2;
  });

  return <mesh ref={ref}>...</mesh>;
}
```

## Anti-Patterns

### ❌ 3D For 3D's Sake
**Instead**: 3D should serve a purpose. Ask: would an image/SVG work?

### ❌ Desktop-Only 3D
**Instead**: Test on real mobile devices. Provide static fallback.

### ❌ No Loading State
**Instead**: Loading progress indicator. Optimize model size.

## Relevance to Knots

Applicable when extending the SVG rendering layers (`renderer/layers/`) into WebGL-based rendering for complex contact graph visualizations, or adding 3D knot diagram views. Patterns for canvas/scene management translate directly to the custom layer architecture.

## Related Skills

Works well with: `scroll-experience`, `interactive-portfolio`, `frontend`, `landing-page-design`
