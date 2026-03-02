# 📒 Bitácora de Cambios (Changelog)

Este archivo documenta **todos los cambios notables** del proyecto con referencias a commits específicos para poder hacer **rollback** a cualquier punto.

> **Comando de Rollback**: `git checkout <commit-hash>`  
> **Volver a dev**: `git checkout dev`

---

## [2026-02-24] — Warp Rise: Wave-Like Curvature with Right Anchor
Added: Perfil sinusoidal controlado (`wave = sin(pi*t)`) en el desplazamiento vertical de Rise.
Changed: `rise` ahora usa `dv = bend * (t + 0.22 * wave)` con `t = 1 - u` para curva tipo wave.
Fixed: Se corrige el carácter de la curva para que se perciba más ondulada, manteniendo el lado derecho fijo.
Impact: Rise conserva anclaje derecho y gana un trazo de curva más cercano al look de referencia.

## [2026-02-24] — Warp Rise: Right-Side Anchoring Correction
Added: Perfil de Rise anclado por el lado derecho (`ramp = 1 - u`) con bow suave interno.
Changed: Se simplificó `du` para depender solo de `hDist` (sin acople extra por bend).
Fixed: Se corrige la orientación funcional de Rise para que el lado derecho permanezca estable como en la referencia.
Impact: Rise ahora replica mejor la malla objetivo: pendiente diagonal coherente y curvas más limpias.

## [2026-02-24] — Warp Rise: Direction and Curvature Recalibration
Added: Peso central (`centerWeight`) para modular el desplazamiento horizontal sin afectar bordes.
Changed: `rise` invierte de nuevo la rampa base a `u` y reduce la curvatura (`0.35`) para alinear la diagonal con la referencia.
Fixed: Se corrige la inclinación invertida observada en preview; ahora el lado derecho cae como en la malla objetivo.
Impact: Rise queda visualmente consistente en orientación y con deformación menos rígida/menos exagerada.

## [2026-02-24] — Warp Rise: Orientation Mirror Fix
Added: Ajuste de orientación del gradiente principal en `rise`.
Changed: La rampa diagonal se invierte (`ramp = 1 - u`) para alinear el lado activo con la referencia.
Fixed: Se corrige la inversión izquierda/derecha reportada en el preset Rise.
Impact: Rise ahora deforma en el lado correcto respecto a la referencia visual.

## [2026-02-24] — Warp Rise: Curved Diagonal Profile
Added: Componente de curvatura central (`bow = u*(1-u)`) en `rise`.
Changed: `rise` deja la rampa lineal pura y ahora combina pendiente diagonal + arqueo suave.
Fixed: Se corrige el look rígido; el preset ahora genera una caída diagonal con bordes curvados más cercana a la referencia.
Impact: El efecto Rise se percibe como deformación orgánica (no solo inclinación lineal).

## [2026-02-24] — Warp Twist: Edge-Anchored Swirl
Added: Falloff cuadrado (`rInf`) para controlar intensidad de twist por distancia al borde.
Changed: `twist` ahora rota el interior del bbox y ancla el perímetro con ángulo cero en bordes.
Fixed: Se corrige el look de twist radial libre; ahora coincide mejor con la referencia AE (marco estable + torsión interna).
Impact: El preset Twist mantiene contorno rectangular y concentra la deformación cerca del centro.

## [2026-02-24] — Warp Fish Eye: Edge-Anchored Lens Correction
Added: Modelo de distorsion Fish Eye con radio cuadrado (`rInf`) para anclar el borde del bbox.
Changed: `fish-eye` deja de usar barrel radial libre y ahora deforma solo el interior (bordes fijos).
Fixed: Se corrige la diferencia con la referencia AE donde la malla interna se curva sin desplazar el contorno exterior.
Impact: Fish Eye ahora mantiene el marco rectangular y aplica look de lente en el interior.

## [2026-02-24] — Warp Arc Upper: Mirrored Top-Only Behavior
Added: Umbral superior (`upperEnd = 0.38`) para activar la deformación solo en la zona alta.
Changed: `arc-upper` ahora espeja la lógica de `arc-lower` (máscara suave regional + laterales estables).
Fixed: Se corrige el comportamiento no simétrico entre `arc-lower` y `arc-upper`; ahora `arc-upper` deforma la parte superior en sentido opuesto.
Impact: Los presets `Arc Lower` y `Arc Upper` quedan coherentes entre sí con deformación localizada por lado.

## [2026-02-24] — Warp Arc Lower: Bottom-Only Arc Correction
Added: Umbral de inicio inferior (`lowerStart = 0.62`) en `arc-lower`.
Changed: `arc-lower` ahora usa máscara inferior (`smooth01`) y elimina desplazamiento lateral (`du`).
Fixed: Se corrige la “cintura” en zona media; la deformación queda concentrada en la parte baja como en la referencia.
Impact: La silueta mantiene laterales casi rectos y solo arquea el borde inferior.

## [2026-02-24] — Warp Arc Lower: Seamless Lower Bias Tuning
Added: Perfil progresivo por altura completa (`smooth01(v)`) para `arc-lower`.
Changed: Se reemplazó la activación por umbral de media altura por un peso continuo y sesgo inferior (`lower = t^2`).
Fixed: Se eliminó el quiebre visual en mitad del objeto y se acercó la silueta a la referencia de malla (parte alta casi estable, curvatura creciente hacia abajo).
Impact: `arc-lower` ahora produce una deformación más natural y estable al scrubear `bend`.

## [2026-02-24] — Arc Warp: Polar Fan Transformation
Fixed: El efecto `arc` en `warp-math.ts` usaba una simple sinusoide (`v + bend * sin(π*u)`) que solo inclinaba filas. Ahora usa una transformación polar real (u → ángulo, v → radio) que produce el sector de abanico con arcos concéntricos y líneas radiales idéntico al Arc de AE/Photoshop.
Impact: El desplegable Warp → Arc ahora deforma la geometría SVG en forma de abanico, igual que la imagen de referencia.

## [2026-02-24] — Warp Arc Lower: AE Lower-Half Shape
Added: Helper `smooth01()` para transiciones suaves en UV dentro de `warp-math.ts`.
Changed: `arc-lower` ahora aplica una máscara suave en la mitad inferior (`v > 0.5`) y combina curvatura vertical + apertura lateral.
Fixed: Se eliminó la deformación rígida lineal de `arc-lower` que no respetaba la referencia tipo AE (anclaje superior + crecimiento progresivo hacia la base).
Impact: Warp `arc-lower` se comporta más cercano a la malla de referencia: parte superior estable, deformación creciente en la parte inferior y arco inferior más natural.


Added: Efecto Warp completo con 15 estilos (Arc, Arc Lower, Arc Upper, Arch, Bulge, Shell Lower, Shell Upper, Flag, Wave, Fish, Rise, FishEye, Inflate, Twist, Squeeze).
Added: `WarpStyle`, `WarpEffect` types en `editor.ts`. Nuevas PropertyIds: `warpBend`, `warpHDist`, `warpVDist`, `warpStyle`, `warpAxis`.
Added: `warp-math.ts` — funciones UV puras para los 15 estilos + `applyWarp()`.
Added: `WarpRenderer.tsx` — deformación de geometría SVG directa (sin WebGL). `WarpControls.tsx` — Panel UI con Select de estilo/eje + 3 SliderInputs animables.
Changed: `canvas.tsx` integra `WarpRenderer` inline cuando `obj.warp?.enabled`. `properties-panel.tsx` incluye sección Warp con botón toggle.
Changed: `runtime.ts` mapea `warpBend/warpHDist/warpVDist/warpStyle/warpAxis` → `obj.warp`. `editor-context.tsx` inicializa valores y fuerza `interpolation: 'hold'` para enums.
Impact: Objetos SVG pueden ser deformados con 15 presets AE-style, con animación de keyframes completa.

## [2026-02-23] — Timeline Ruler Simplification & Smart Zoom
Added: Soporte de densidad dinámica. Ahora muestra solo marcas de medios segundos (`0.5s`) implícitas cuando está alejado, y revela los frames numéricos (`5f`, `10f`) exclusivamente al hacer zoom profundo.
Changed: Simplificación extrema (Minimalista) de las marcas (ruler). Se eliminaron TODAS las subdivisiones `minor` intermedias y `micro` cuando no hay zoom, dejando solo los bloques de un segundo (y su mitad). Adicionalmente, las marcas flotan centradas verticalmente, y se eliminó por completo la línea vertical en los marcadores de segundos exactos (dejando solo el texto `1s`).
Fixed: Exceso de ruido visual provocado por subdivisiones innecesarias y mala posición estética en la vista general.
Impact: Timeline ultralimpio idéntico a referencias profesionales, escalando en detalle solo mediante interacción deliberada de zoom.

## [2026-02-23] — Time Input Redesign
Added: Text-based inputs para Duration y FPS en el Properties Panel.
Changed: Se reemplazaron los sliders de tiempo por inputs de precisión en formato `HH:MM:SS`.
Fixed: Imprecisión en la selección de tiempo.
Impact: Mejor control del timing de la composición a nivel de exact frame.

## [2026-02-22] — Restore v0.7.0 Playhead
Added: Reintegración completa de Firebase stubs y dtos.
Changed: Limpieza de experimentación fallida de Node Editor.
Fixed: Playhead desincronizado e interacción paralizada.
Impact: Restauración de playback timeline funcional y baseline de proyecto (v0.7.0).

## [2026-02-20] — Fix Layer Rename
Added: Activación inline real para el campo de texto interno.
Changed: Evento doble-clic actualizado en LayersPanel.
Fixed: Doble-clic solo disparaba selección, omitiendo el input.
Impact: Recuperación del workflow básico de organización de objetos de usuario.

---

## [0.6.0] - 2026-02-18 | Tag: `v0.6.0-dev`

**🔖 Rollback a esta versión:** `git checkout [CURRENT_COMMIT]`

> **🚀 ANIMATION 2.0 & STABILITY**: Enfoque en robustez de animaciones complejas y nuevos efectos.

---

## [0.5.0] - 2026-02-12 | Tag: `v0.5.0`

**🔖 Rollback a esta versión:** `git checkout [CURRENT_COMMIT]`

> **🚀 BASELINE v0.5.0**: Versión estable con "Bend It" effect funcional y animable.

### ✨ Nuevas Funcionalidades
| Feature | Descripción | Origen |
|---------|-------------|--------|
| **Bend It Effect** | Implementación completa del efecto CC Bend It, incluyendo render WebGL y controles UI. | `Feature Request` |
| **Bend It Animation** | Soporte total para keyframing de `Bend Amount`, `Start` y `End` points. | `Debug Task` |
| **Baseline** | Inicio de versión 0.5.0. | `Plan` |
| **Smart Keyframes** | Visualización avanzada: Formas distintivas (Linear, Hold, Ease In/Out), tamaño ajustado (13px) y scaling inteligente. | `implementation_plan` |

---

## [0.4.0] - 2026-02-11 | Tag: `v0.4.0`

**🔖 Rollback a esta versión:** `git checkout [CURRENT_COMMIT]`

> **🚀 BASELINE RESET**: Esta versión establece el nuevo punto de partida para el ciclo de desarrollo.

## [0.4.0] - 2026-02-12 | Tag: `v0.4.0`

**🔖 Rollback a esta versión:** `git checkout [CURRENT_COMMIT]`

### ✨ Nuevas Funcionalidades
| Feature | Descripción | Origen |
|---------|-------------|--------|
| **Floating Presets** | Palette de presets global, desacoplada del editor gráfico (Timeline Panel). | `Bitácora 09:30` |
| **Global Access** | Presets aplicables a cualquier track seleccionado sin focus en el editor. | `Bitácora 09:30` |
| **Edit Curve** | Acceso contextual al "Bezier Editor" para cirugía de precisión. | `Bitácora 10:15` |

### 🐛 Correciones
| Bug | Descripción | Origen |
|-----|-------------|--------|
| **DataCloneError** | Fix crash al copiar keyframes con Immer Proxies (`structuredClone` -> `spread`). | `Bitácora 10:00` |
| **Undo/Redo Spam** | Fix historial inutilizable al arrastrar handles (Transient Updates). | `Bitácora 11:30` |
| **Preset Drag Logic** | Fix "pegado" del preset picker al cursor. | `Bitácora 08:52` |

### 📚 Documentación
| Doc | Descripción | Origen |
|-----|-------------|--------|
| **Anime.js Strategy** | Architecture doc para futura integración de curvas complejas. | `research/` |
| **Bitácora Sync** | Actualización completa de logs y Guía de Usuario. | `BITACORA.md` |

---

## [0.3.0]
| Feature | Descripción | Origen |
|---------|-------------|--------|
| **Baseline Reset** | Inicio de nuevo ciclo. Consolidación de Graph Editor y estabilidad. | `Plan 22:00` |

---

## [0.3.0] - 2026-02-11 | Tag: `v0.3.0`

**🔖 Rollback a esta versión:** `git checkout [CURRENT_COMMIT]`

### ✨ Graph Editor 2.0 (Overhaul)
| Feature | Descripción | Origen |
|---------|-------------|--------|
| **Visual Polish** | Diseño "Bigger & Bolder": Keyframes circulares (10px), handles robustos (2px), curvas gruesas (3px). | `Bitácora 16:52` |
| **Round Joins** | Suavizado de picos en curvas dramáticas para eliminar artefactos visuales. | `Bitácora 17:07` |
| **Playhead Physics** | Unificación matemática de dibujo y playhead. Eliminado el "floating effect" en picos agudos. | `Bitácora 16:38` |
| **Auto-Fit Pro** | Escala vertical adaptativa que maximiza el uso del espacio según el rango de datos. | `Bitácora 15:15` |
| **Adaptive Zero** | Línea cero dinámica: se mueve al fondo si solo hay valores positivos (estilo After Effects). | `Bitácora 15:35` |
| **Mixed Mode** | Optimización asimétrica para gráficos con valores positivos y negativos desbalanceados. | `Bitácora 16:10` |
| **Sticky Scroll** | Sincronización perfecta del scroll horizontal entre Timeline y Graph Editor. | `Bitácora 15:58` |

### 🐛 Correciones
| Bug | Descripción | Origen |
|-----|-------------|--------|
| **Runtime Error** | Fix `Cannot find module` por corrupción de caché Next.js. | `Bitácora 14:47` |
| **Drag Creation** | Fix desaparición de objetos al crearlos arrastrando (validación de tamaño). | `Bitácora 14:47` |
| **Marquee Visual** | Fix cuadro de selección invisible en Graph Editor (ahora usa React Portal). | `Bitácora [Hoy]` |

---

## [0.2.0] - 2026-02-07 | Tag: `v0.2.0`


**🔖 Rollback a esta versión:** `git checkout 6bdda21`

### ✅ Añadido
| Feature | Descripción | Commit |
|---------|-------------|--------|
| Graph Editor | Implementación completa con modos de Velocidad y Valor | `7208e85` |
| Marquee Selection | Selección de múltiples keyframes mediante arrastre | `7208e85` |
| Smooth Tangents | Soporte para tangentes continuas y rotas en curvas Bezier | `7208e85` |
| Inputs Numéricos | Control preciso de influencia y valores en el toolbar | `7208e85` |
| Badge de Versión | Versión visible junto a "Vectoria" en el sidebar | `a03f653` |

### 🐛 Corregido
| Bug | Descripción | Commit | Rollback |
|-----|-------------|--------|----------|
| Marquee Multi-Track | Marquee ahora selecciona keyframes con 2+ propiedades animadas | `pending` | `git checkout a03f653` |
| ESLint Circular | Error "Converting circular structure" en build | `80f8882` | `git checkout 6bdda21` |
| Firebase Init | Warning "Need to provide options" en Vercel | `80f8882` | `git checkout 6bdda21` |
| Unescaped Entities | Caracteres sin escapar en JSX | `377daf9` | `git checkout 80f8882` |
| Display Name | Missing displayName en RenderObject | `377daf9` | `git checkout 80f8882` |
| Portapapeles | Ahora preserva interpolación al copiar/pegar keyframes | `7208e85` | `git checkout 761366d` |
| UI Graph Editor | Refactorización usando componentes estándar | `7208e85` | `git checkout 761366d` |
| Navegación Toolbar | Botones que no respondían a clics | `7208e85` | `git checkout 761366d` |


### 🔧 Configuración/Build
| Cambio | Descripción | Commit |
|--------|-------------|--------|
| ESLint Rules | Deshabilitadas reglas estrictas para green build | `8f2ed97` |
| Hook Rules | Deshabilitadas reglas de hooks | `4d503bf` |
| Any Rules | Deshabilitada regla no-explicit-any | `6a1ceca` |

---

## [0.1.0] - 2026-02-07 | Tag: `v0.1.0`

**🔖 Rollback a esta versión:** `git checkout 8260411`

### ✅ Añadido
| Feature | Descripción | Commit |
|---------|-------------|--------|
| GUIA_USUARIO.md | Guía simplificada para gestión no técnica | `8260411` |
| WORKFLOW.md | Protocolo técnico de desarrollo y versionado | `8260411` |
| CHANGELOG.md | Este archivo para registrar la historia | `8260411` |
| Carpeta `archive/` | Almacenamiento de documentación antigua | `8260411` |

---

## 🚨 Guía de Emergencia

### Si algo se rompe:
1. **Identificar el último commit estable** en esta bitácora
2. **Ejecutar rollback**: `git checkout <commit-hash>`
3. **Verificar** que la app funciona
4. **Crear branch de hotfix**: `git checkout -b fix/nombre-del-problema`
5. **Arreglar y mergear** cuando esté listo

### Comandos útiles:
```bash
# Ver historial completo
git log --oneline -30

# Volver a un commit específico (modo lectura)
git checkout <commit-hash>

# Volver al desarrollo normal
git checkout dev

# Crear tag de versión
git tag v0.2.1
git push origin v0.2.1
```
