# 👁️ Visual Excellence Audit
**Status:** 🔴 Needs Alignment
**Date:** 2026-02-05
**Auditor:** Antigravity (Senior Product Designer)

## 1. 🌍 Executive Summary
The foundation of **Vectoria** is strong. It feels like a "Pro Tool" (After Effects/Figma class) rather than a toy. The **Glassmorphism** implementation is high-quality—subtle and native-feeling. However, the app suffers from **"Micro-Jitter"** (misalignments in high-density areas) and contrast issues that hurt scanability. The "Neon/Gamer" aesthetic clashes slightly with the "Pro Productivity" goal.

---

## 2. 🏆 Visual Wins
> These are approved patterns. Do not break.

*   **Premium Glassmorphism**: The usage of `backdrop-blur-md` with thin, low-opacity borders (`border-white/10`) is excellent. It creates depth without muddiness.
*   **Interaction Feedback**: Hover states on layers and focus rings on inputs are snappy (<100ms perceived) and widely consistently.
*   **Layout Density**: The information density is correct for a pro tool. It avoids the "SaaS sprawl" (too much whitespace) often seen in web apps converted to pro tools.
*   **Key Component Interactions**: Switching between **Graph Editor** and **Dope Sheet** feels solid.

---

## 3. 🚨 Critical Fails & "Visual Debt"
> These must be fixed to pass the Visual Quality Gate.

### A. Alignment & Spacing (The "Jitter")
*   **Property Inspector Labels**: The labels (`X`, `Y`, `W`, `H`) are visibly misaligned vertical-center relative to their input fields. This makes the panel feel "loose."
    *   *Fix*: Enforce strict `items-center` or baseline alignment in flex containers.
*   **Anchor Point Grid**: The 3x3 grid widget is visually lost/too small in its container. It lacks touch-target confidence.

### B. Typography & Contrast
*   **Low Contrast Text**: "Muted" text (in Layers/Tooltips) is frequently too dark (`#444` on `#000` approx), failing WCAG AA.
    *   *Fix*: Bump muted text foreground brightness (e.g., `text-zinc-500` -> `text-zinc-400` in dark mode).
*   **Label Hierarchy**: In the Dope Sheet, active vs. inactive tracks are hard to distinguish at a glance.

### C. Aesthetic Direction
*   **"Gamer" Glow**: The bright blue top-glow feels slightly out of place for a serious productivity tool.
    *   *Recommendation*: Tone down saturation or switch to a neutral "Studio Light" glow (white/blue-grey).

---

## 4. 🛠️ Action Plan (Incremental)

### Phase 1: The "Tighten" Pass (Low Risk, High Impact)
- [ ] **Global Type Tweak**: Bump contrast on all `muted-foreground` utilities.
- [ ] **Property Panel alignment**: Refactor the Inspector rows to use a strict Grid or Flex system that aligns labels x inputs perfectly.
- [ ] **Dope Sheet Contrast**: Add a clearer background tint (`bg-white/5`) to active timeline tracks.

### Phase 2: Refinement (Medium Risk)
- [ ] **Anchor Widget Redesign**: Rebuild the 3x3 anchor grid to be distinct and clickable.
- [ ] **Glow Reduction**: Adjust the global decorative gradients to be more "Pro" (subtle).

---

## 5. 📸 Artifacts
*See `/design-inspo` for reference patterns.*
