# 📘 UI Design Rules: The "Pro Motion" System
**Reference**: [Adobe After Effects Redesign Concept by Maximilian Müsgens](https://www.behance.net/gallery/81871659/Adobe-After-Effects-Redesign-Concept)

This document defines the visual language for our project, based on a "Dark Mode First" professional motion graphics aesthetic.

---

## 1. Design Philosophy
*   **The "Floating" Workspace**: Panels are not docked rigid blocks; they are floating cards with distinct depth, sitting above a deep canvas.
*   **Content Over Chrome**: The interface recedes. Tools are minimized. The user's content (the animation curves, the composition) is the hero.
*   **Friendly Precision**: We move away from "industrial/aggressive" sharp corners to rounded, approachable geometry without losing professional precision.

---

## 2. Color System 🎨

### Base Palette (The "Darkroom")
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--bg-app` | `#0D0D0D` | The deepest background (App shell). |
| `--bg-panel` | `#141414` | Standard panel background. |
| `--bg-panel-floating` | `rgba(26, 29, 35, 0.85)` | **Glassmorphism** panels (Graph Editor) with `backdrop-filter: blur(20px)`. |
| `--stroke-dim` | `rgba(255, 255, 255, 0.1)` | Subtle borders for panels to define edges in the dark. |
| `--text-primary` | `#FFFFFF` | Main headers and critical data. |
| `--text-secondary` | `#9ca3af` | Labels, unselected properties. |

### Accent Colors (The "Neon Lights")
Used sparingly for focus, selection, and active states.

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--primary-blue` | `#4D96FF` | **Reference Brand Color**. Selection state, active tools, Playhead. |
| `--accent-glow` | `#007AFF` | Used for "Glow" effects on handles and active elements. |

### Data Visualization (The "Speed Graph")
| Token | Gradient / Color | Usage |
| :--- | :--- | :--- |
| `--curve-gradient` | `linear-gradient(to right, #FF7E5F, #FEB47B)` | The main animation curve. Vibrant Orange -> Peach. |
| `--handle-line` | `#007AFF` | Bezier handles. |
| `--grid-line` | `#2D3139` | Background grid lines (thin, 1px). |

### Label Palette
For organizing layers/assets.
*   **Apricot**: `#FFB579`
*   **Palmleaf**: `#96E6B3`
*   **Lavender**: `#DAAEF2`
*   **Rose**: `#FF7E9F`

---

## 3. Typography 🔠
**Font Family**: `Inter` or `Circular` (Geometric Sans-Serif).
*   **Case**: Sentence case for labels (e.g., "Motion blur" not "MOTION BLUR").
*   **Weights**:
    *   **Bold (600)**: Headers.
    *   **Regular (400)**: Labels.
    *   **Mono**: Numbers in input fields (for alignment).

### Type Scale
*   **Panel Title**: 14px / Semi-Bold / Text-White.
*   **Property Label**: 11px / Regular / Text-Secondary.
*   **Input Value**: 11px / Mono / Text-Primary.

---

## 4. Iconography
*   **Style**: Hybrid (Outline with slightly rounded terminals).
*   **Stroke**: 1.5px (Lightweight).
*   **Shape**: Softened geometry. No sharp 90-degree outer corners on icons.

---

## 5. Components & Layout rules

### The "Floating Panel" (Card)
Every main functional area (Project, Timeline, Graph) follows this recipe:
```css
.modern-panel {
  background: var(--bg-panel);
  border-radius: 12px; /* Smooth corners */
  box-shadow: 0 10px 30px rgba(0,0,0,0.5); /* Deep elevation */
  border: 1px solid var(--stroke-dim);
}
```

### The Speed Graph (Special "Glass" Variant)
The Graph Editor is treated as a premium overlay.
```css
.speed-graph-container {
  /* Glassmorphism base */
  background: var(--bg-panel-floating);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  
  /* Inner light cues */
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}
```

---

## 6. Interaction States (Motion)
*   **Hover**: Elements do not just change color; they lift or brighten.
    *   `transition: all 0.2s ease-out`.
    *   Lighten background by 5-10%.
*   **Active/Selected**:
    *   Primary Blue border or fill.
    *   **Glow**: Active handles need a subtle `drop-shadow(0 0 8px var(--primary-blue))` to feel powered on.

---

## 7. Implementation Checklist
1.  [ ] **Global CSS**: Set up the CSS Variables (`:root`) for the Color System.
2.  [ ] **Layout**: Refactor existing detailed panels to use `border-radius: 12px` and remove heavy borders.
3.  [ ] **Graph Editor**: Apply the specific Glassmorphism and Gradient Curve styles to the SVG elements.
4.  [ ] **Typography**: Enforce `Inter` and reduce label sizes to 11px for that "Pro Tool" density.
