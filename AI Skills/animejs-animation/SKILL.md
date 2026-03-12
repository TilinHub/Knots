---
name: animejs-animation
description: Advanced JavaScript animation library skill for creating complex, high-performance web animations.
risk: safe
source: community
date_added: "2026-03-07"
---

# Anime.js Animation Skill

[Anime.js](https://animejs.com/) is a lightweight but extremely powerful JavaScript animation engine. It excels at complex timelines, staggering, and precise control over DOM, CSS, and SVGs.

## Context

This skill is used for creating high-fidelity, jaw-dropping web animations that go far beyond simple CSS transitions. It's the tool of choice for awards-caliber interactive sites.

## When to Use

Trigger this skill when:

- Creating complex, multi-stage landing page orchestrations.
- Implementing staggered animations for revealing grids, text, or data visualizations.
- Animating SVG paths (morphing shapes, drawing dynamic lines).
- Building highly interactive, kinetic UI elements that respond fluidly to user input.

## Execution Workflow

1. **Identify Targets**: Select the DOM elements or SVGs to be animated.
2. **Define Properties & Easing**: Specify values to animate. Utilize advanced easing functions (e.g., custom `cubicBezier`, `spring`, or `elastic`).
3. **Orchestrate Timelines**: Use `anime.timeline()` to sequence complex choreography.
4. **Implement**:
   ```javascript
   const tl = anime.timeline({
     easing: "spring(1, 80, 10, 0)",
     duration: 1000,
   });
   tl.add({
     targets: ".hero-text",
     translateY: [50, 0],
     opacity: [0, 1],
     delay: anime.stagger(100),
   }).add(
     { targets: ".hero-image", scale: [0.9, 1], opacity: [0, 1] },
     "-=800",
   );
   ```

## Strict Rules

- **ABSOLUTE MANDATE**: Build modern, creative, and visually stunning UI/UX. DO NOT build common, boring transitions.
- **Staggering**: Leverage `anime.stagger()` extensively for organic rhythm.
- **Performance**: Use `will-change: transform, opacity` for GPU acceleration.

## SVG Animation (Relevant to Knots)

```javascript
// Animate SVG path drawing (stroke-dashoffset technique)
anime({
  targets: '.knot-path',
  strokeDashoffset: [anime.setDashoffset, 0],
  easing: 'easeInOutSine',
  duration: 1500,
  delay: anime.stagger(150),
});

// Animate disk nodes appearing
anime({
  targets: '.contact-disk',
  scale: [0, 1],
  opacity: [0, 1],
  easing: 'spring(1, 80, 10, 0)',
  delay: anime.stagger(80, { from: 'center' }),
});

// Animate envelope path morphing
anime({
  targets: '#envelope-path',
  d: [{ value: newPathData }],
  easing: 'easeInOutCubic',
  duration: 600,
});
```

## Relevance to Knots

Directly applicable to the SVG rendering layers (`renderer/layers/`). Use for animating:
- Contact disk nodes appearing/disappearing
- Envelope path transitions when disk positions change
- Knot diagram mode transitions
- Rolling disk simulation animations
- Graph edge drawing in the contact graph editor
