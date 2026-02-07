# 🎨 Visual Language & Rules

## 1. 📏 Spacing & Density
**The Rule of 4px**.
*   All gaps, margins, and paddings must be multiples of 4 (4, 8, 12, 16).
*   **Pro Density**:
    *   Panel Padding: `p-3` (12px) is the max for containers. `p-2` (8px) is standard for list items.
    *   Input Height: `h-8` (32px) for standard inputs. `h-7` (28px) for dense property inputs.
    *   Gap: `gap-2` (8px) between major elements. `gap-1` (4px) between labels and inputs.

## 2. 🔠 Typography
**Font**: *Inter* (Default sans).

| Role | Class | Size | Weight | Color |
| :--- | :--- | :--- | :--- | :--- |
| **Panel Header** | `text-sm font-medium` | 14px | 500 | `text-foreground` |
| **Label (Strong)** | `text-xs font-medium` | 12px | 500 | `text-zinc-400` |
| **Label (Subtle)** | `text-[11px] font-normal` | 11px | 400 | `text-zinc-500` |
| **Input Value** | `text-xs font-mono` | 12px | 400 | `text-foreground` |

**Rule**: Use `font-mono` for all numeric values in Inspectors to prevent layout shifting when numbers change.

## 3. 🌈 Color System (Dark Mode First)

### Structure
*   **Canvas/Stage**: `bg-zinc-950/50` (Translucent dark)
*   **Panels**: `bg-black/40` + `backdrop-blur-xl` + `border-white/10`
*   **Interactive Active**: `bg-white/10` (Hover), `bg-white/20` (Active/Selected)
*   **Accents**:
    *   `orange-500`: Playhead/Time
    *   `blue-500`: Selection
    *   `emerald-500`: Keyframes

### 🚫 Anti-Patterns (Do Not Use)
*   Do not use pure black (`#000`) for panel backgrounds; it kills the glass effect. Use `black/40` or `zinc-950/80`.
*   Do not use "Gray" text (`text-gray-500`). Use **Zinc** (`text-zinc-500`) to match the blue-ish warm grey tone of modern UIs.
