# AI Skills

This directory contains curated skill definitions for AI coding assistants (Cursor, Copilot, Claude, etc.) sourced from [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills).

Each skill is a structured prompt that guides an AI to behave as a domain expert when working on specific problems in this codebase.

## Skills Included

| Skill | Description | Knots Relevance |
|-------|-------------|----------------|
| [`algorithmic-art`](./algorithmic-art/SKILL.md) | Generative art with p5.js, seeded randomness, computational geometry | SVG rendering, contact graph visualization |
| [`architecture-patterns`](./architecture-patterns/SKILL.md) | Clean Architecture, Hexagonal, DDD | Enforcing `core/` purity, layered architecture |
| [`3d-web-experience`](./3d-web-experience/SKILL.md) | Three.js, React Three Fiber, WebGL, SVG scenes | Rendering layers, future 3D knot views |
| [`architect-review`](./architect-review/SKILL.md) | Master architect for reviewing design decisions | `EnvelopeComputer` interface, cross-layer dependencies |
| [`animejs-animation`](./animejs-animation/SKILL.md) | Advanced SVG/DOM animations with Anime.js | Disk node transitions, envelope path morphing |

## How to Use

When working with an AI assistant on a specific problem, prepend the relevant `SKILL.md` content as system context. For example:

- **Fixing node positioning bugs** → use `algorithmic-art` + `architect-review`
- **Refactoring envelope computation** → use `architecture-patterns` + `architect-review`
- **Adding animations to the canvas** → use `animejs-animation`
- **Extending rendering layers** → use `3d-web-experience`
