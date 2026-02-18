# 📒 Bitácora de Cambios (Changelog)

Este archivo documenta **todos los cambios notables** del proyecto con referencias a commits específicos para poder hacer **rollback** a cualquier punto.

> **Comando de Rollback**: `git checkout <commit-hash>`  
> **Volver a dev**: `git checkout dev`

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
