# 🌊 Vectoria Workflow & Versioning Protocol

This document defines the **standard operating procedure** for development, versioning, and releasing changes in the Vectoria project.

## 1. Versioning Strategy (SemVer)

We follow **Semantic Versioning 2.0.0** (`vMAJOR.MINOR.PATCH`).

### Structure
- **MAJOR** (`1.0.0`): Incompatible API changes or complete Engine rewrites.
- **MINOR** (`0.1.0`): New features / substantial improvements (Backward compatible).
- **PATCH** (`0.0.1`): Bug fixes, hotfixes, and minor chores (Backward compatible).

### Examples
- `0.1.0`: Initial Beta Release.
- `0.1.1`: Fix layout shift in Properties Panel.
- `0.2.0`: Add "Speed Graph" feature.

### Milestone-Based Release Philosophy

> **"No subimos a v1.0.0 hasta que la app esté lista para mostrar al mundo"**

| Fase | Versiones | Objetivo |
| :--- | :--- | :--- |
| **Estabilización** | `0.x.x` | Bug fixes, pulir UX, resolver deuda técnica |
| **Lanzamiento** | `1.0.0` | App estable, confiable, lista para usuarios finales |

**Criterios para v1.0.0:**
- [ ] Sin bugs críticos conocidos
- [ ] UX pulida y consistente
- [ ] Performance aceptable
- [ ] Documentación completa

---

## 2. Branching Strategy

We use a simplified **Git Flow** suitable for a Squad/Agent environment.

| Branch | Role | Rules |
| :--- | :--- | :--- |
| `main` | **Production** | 🔴 **Protected**. Always deployable. No direct commits. |
| `dev` | **Integration** | 🟡 **Staging**. All feature branches merge here first. |
| `feat/*` | Feature | New features (e.g., `feat/speed-graph`). |
| `fix/*` | Bugfix | Bug fixes (e.g., `fix/properties-panel-crash`). |
| `chore/*` | Maint | Refactors, docs, tooling (e.g., `chore/update-deps`). |

### Workflow Lifecycle
1.  **Branch Off**: Create `feat/my-feature` from `dev` (or `main` if starting fresh).
2.  **Implement**: Commit changes.
3.  **Verify**: Run tests/build locally.
4.  **Merge**: Merge into `dev`.
5.  **Release**: When `dev` is stable, merge `dev` -> `main` with a Version Tag.

---

## 3. The "Pull Request" Protocol (Agent Mode)

Since we are operating as an Agent/User squad, we simulate PRs through **Verification Gates**.

**Before merging to `dev` or `main`:**
1.  ✅ **Build Check**: `npm run build` must pass.
2.  ✅ **Lint Check**: `npm run lint` must pass (or have clear TODOs).
3.  ✅ **Visual Audit**: New UI elements must be verified in-browser.
4.  ✅ **Self-Correction**: Logic must be explained in the chat before applying critical changes.

---

## 4. Commit Convention

We use **Conventional Commits** to automate changelogs (optional but recommended).

- `feat: add marquee selection`
- `fix: resolve hydration mismatch`
- `docs: update workflow rules`
- `style: adjust sidebar contrast`
- `refactor: simplify timeline reducer`

---

## 5. File Management & Archiving

To keep the project root clean (`/`), we follow this policy:

- **Active Plans**: Kept in root (e.g., `PLAN.md`, `PROFESSIONAL_UI_PLAN.md`).
- **Archive**: Completed audits, superseded plans, or old analyses are moved to `/archive`.
- **Root Files**: Only essential config, `README.md`, `WORKFLOW.md`, and current `PLAN.md` should remain in root long-term.

### 🤖 Auto-Archival Rule
**Agente**: When a Plan is marked as `[x] Completed` in `PLAN.md`, you **MUST** immediately run `npm run archive <PlanFile.md>` to keep the workspace clean.

---

## 6. Optimized Git Strategy (Credit Saver)

To optimize AI token consumption, we use a **Low-Frequency Commit Strategy**.

### The Rule
> **"Don't ask the Agent to commit every small change."**

### Protocol
1.  **Work Session**: We perform multiple related changes (e.g., "Fix styling", "Refactor logic", "Update docs") in a single session.
2.  **Bitácora First**: We log progress in `BITACORA.md` (Low cost) instead of Git (High cost/risk).
3.  **Checkpoint (The Save Point)**: Only when a **Task** or **Feature** is 100% complete and verified, we commit.

### User Override (Free Tier)
*   **Tip**: You (The User) can run `git commit -am "wip"` in your terminal at any time. **It's free.**
*   The Agent will only request a commit when closing a major task to establish a safe rollback point.
