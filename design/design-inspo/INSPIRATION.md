# 💡 Design Inspiration & References

## 1. 🌟 North Stars (The standard we aim for)

### **Linear** (https://linear.app)
*   **Why**: The masterclass in "high density, low clutter".
*   **Steal**:
    *   The `Command+K` menu aesthetic.
    *   Subtle spacing (4px/8px grid).
    *   The "ghost" hover states on list items.

### **Rive** (https://rive.app)
*   **Why**: Best-in-class web-based animation tool.
*   **Steal**:
    *   **Timeline Density**: Notice how small their headers are (10-11px).
    *   **State Machine Inputs**: The way they connect inputs to logic.
    *   **Graph Editor**: The contrast between "broken" and "smooth" handles.

### **Spline** (https://spline.design)
*   **Why**: 3D web tool with excellent "floating" panels.
*   **Steal**:
    *   **Glass Panels**: Their use of backdrop blur is deeper/darker than standard.
    *   **Mini-Inputs**: Their X/Y/Z inputs are extremely compact but clickable.

---

## 2. 📚 Pattern Reference

### **The "Inspector" Pattern**
*   **Current Issue**: Our inspector aligns labels `center`, but they feel "floaty".
*   **Ref**: Look at **Webflow**'s inspector.
    *   Labels are TINY (10px, uppercase), sitting *above* or *left-aligned* strictly.
    *   Inputs show values clearly (~13px).

### **Timeline Tracks**
*   **Ref**: **After Effects**
    *   Alternating row colors (very subtle, e.g., `#1a1a1a` vs `#1f1f1f`) help eye tracking over long distances.
    *   We currently have flat black; moving to alternating rows might reduce cognitive load.
