---
name: architecture-decision-records
description: "Write and maintain Architecture Decision Records (ADRs) following best practices for technical decision documentation. Use when documenting significant technical decisions, reviewing past architectural choices, or establishing decision-making processes."
risk: unknown
source: community
date_added: "2026-02-27"
---

# Architecture Decision Records

Comprehensive patterns for creating, maintaining, and managing Architecture Decision Records (ADRs) that capture the context and rationale behind significant technical decisions.

## Relevance to Knots

Use this skill to **formally document algorithmic decisions** in the Contact Graph and knot diagram pipeline — e.g., *"Why Fruchterman-Reingold over Barnes-Hut for node layout"*, *"Why SVG over Canvas for rendering"*, *"Why EnvelopeComputer uses immutable records"*. Invaluable for onboarding and preventing regression on hard-won design choices.

## Use this skill when

- Making significant architectural decisions
- Documenting technology choices
- Recording design trade-offs
- Onboarding new team members
- Reviewing historical decisions
- Establishing decision-making processes

## Do not use this skill when

- You only need to document small implementation details
- The change is a minor patch or routine maintenance
- There is no architectural decision to capture

## Core Concepts

### What is an ADR?

An Architecture Decision Record captures:
- **Context**: Why we needed to make a decision
- **Decision**: What we decided
- **Consequences**: What happens as a result

### When to Write an ADR

| Write ADR | Skip ADR |
|-----------|----------|
| New framework adoption | Minor version upgrades |
| Database technology choice | Bug fixes |
| API design patterns | Implementation details |
| Security architecture | Routine maintenance |
| Integration patterns | Configuration changes |

### ADR Lifecycle

```
Proposed → Accepted → Deprecated → Superseded
              ↓
           Rejected
```

## Standard ADR Template (MADR Format)

```markdown
# ADR-NNNN: [Title]

## Status
Accepted | Proposed | Deprecated | Superseded by ADR-XXXX

## Context
[Why this decision was needed]

## Decision Drivers
* [Driver 1]
* [Driver 2]

## Considered Options
### Option 1: [Name]
- Pros: ...
- Cons: ...

### Option 2: [Name]
- Pros: ...
- Cons: ...

## Decision
We will use **[chosen option]**.

## Rationale
[Why this option wins]

## Consequences
### Positive
- ...
### Negative
- ...

## Related Decisions
- ADR-XXXX: [related title]
```

## Best Practices

### Do's
- **Write ADRs early** — Before implementation starts
- **Keep them short** — 1-2 pages maximum
- **Be honest about trade-offs** — Include real cons
- **Link related decisions** — Build decision graph
- **Update status** — Deprecate when superseded

### Don'ts
- **Don't change accepted ADRs** — Write new ones to supersede
- **Don't skip context** — Future readers need background
- **Don't hide failures** — Rejected decisions are valuable
- **Don't be vague** — Specific decisions, specific consequences

## Recommended Directory Structure

```
docs/
└── adr/
    ├── README.md           # Index and guidelines
    ├── template.md
    ├── 0001-svg-over-canvas.md
    ├── 0002-envelope-computer-interface.md
    └── 0003-contact-graph-layout-algorithm.md
```

## References

- [Documenting Architecture Decisions (Michael Nygard)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [MADR Template](https://adr.github.io/madr/)
- [ADR GitHub Organization](https://adr.github.io/)
- [adr-tools](https://github.com/npryce/adr-tools)

---

**Source**: [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills/tree/main/skills/architecture-decision-records)
