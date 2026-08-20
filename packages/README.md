# Package boundaries

This directory is the P2.0 workspace skeleton. It contains no SubjectState,
transition, memory, affect, MICL, or other domain behavior.

Future imports must follow this one-way graph through public package roots:

```text
product/sandbox -> runtime
runtime -> subject-core + memory + appraisal + affect + regulation
appraisal -> memory public contracts + subject-core readonly contracts
memory + affect + regulation -> subject-core readonly contracts
subject-core -> no domain or runtime package
```

The P2.0 package manifests intentionally declare no cross-package dependencies.
Dependencies are added only when an authorized implementation imports a public
contract. ESLint rejects reverse edges, deep or dynamic imports, unapproved
external packages, and production imports from `evals/`.

`belief`, `personality`, `relationship`, and `behavior` are deferred empty
packages. Their presence preserves the P1 topology and does not authorize their
implementation.
