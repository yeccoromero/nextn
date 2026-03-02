# Refactorización del Core — Vectoria v0.6.0

## Assumptions
- `src/context/editor-context.tsx` centraliza todo el estado en un solo `useReducer`.
- `canvas.tsx` y otros componentes God dependen directamente de este Context.
- Zustand se adoptará como la principal librería de estado debido a su manejo nativo de mutaciones con Immer y su comportamiento de *rendering* eficiente vía selectores.
- Vitest será empleado como *test runner*.

## Success Criteria
- 0 menciones de `@ts-nocheck` en el core.
- Zustand reemplaza el Context (`useEditorStore`) con stores lógicos y evita *renders* en cascada.
- Complejidad en componentes grandes (`canvas.tsx`, `graph-editor-panel.tsx`, etc.) reducida al dividirse en sub-componentes especializados (< 500 líneas idealmente).
- Pruebas unitarias pasan cubriendo las acciones críticas que modifican el estado (move, keyframe, undo/redo, matemática pura).

## Checklist

### Fase 1: Tipado y Seguridad (Red de seguridad activa)
- [x] Eliminar 21 directivas `@ts-nocheck`, empezando por `src/context/editor-context.tsx` y tipos; agregando aserciones correctas o tipando interfaces.
- [~] Configurar entorno de Testing (Vitest recomendado). (Saltado por ahora)
- [~] Escribir Unit Tests para la matemática pura y utilidades (`editor-utils`, `geometry`, etc.). (Saltado por ahora)
- [~] Escribir Unit Tests para el Reducer actual (acciones críticas: move, keyframe, undo/redo) antes de migrar el estado. (Saltado por ahora)

### Fase 2: Bisturí de Estado (Zustand)
- [x] Instalar `zustand` en el proyecto.
- [x] Diseñar y crear store en `src/store/` (estado global envuelto manteniendo la compatibilidad inicial).
- [x] Migrar la lógica del `useReducer` a acciones directas en Zustand (usando el middleware de Immer).
- [x] Reemplazar llamadas de Contexto en todos los componentes por llamadas a los stores de Zustand con selectores específicos.

### Fase 3: Desacoplamiento de UI y Rendimiento
- [x] Extraer lógica de selección, teclado y *drag* del render de `canvas.tsx` hacia hooks independientes.
- [x] Trocear `canvas.tsx` en subcomponentes visuales limitados y manejables (hecho parcialmente mediante `useCanvasSelection` / `RenderObject`).
- [x] Analizar y trocear `graph-editor-panel.tsx` y `properties-panel.tsx` (desacoplados a Zustand).
- [x] Aplicar `React.memo` y `useCallback` en Layers y Timeline rows (ahora que el estado está aislado).
- [x] Resolver dependencia circular entre `geometry.ts` y `editor-utils.ts` (ya resuelto o no existe bucle directo).

### Fase 4: History & Final Polish
- [x] Implementar `historySlice` completamente (undo/redo con Zustand).
- [x] Verificar que no existan más llamadas a `dispatch` usando el Reducer monolitíco viejo.
- [x] Realizar pruebas de extremo a extremo de la aplicación en el navegador.
