# 📒 Bitácora de Cambios (Changelog)

Este archivo documenta **todos los cambios notables** del proyecto con referencias a commits específicos para poder hacer **rollback** a cualquier punto.

> **Comando de Rollback**: `git checkout <commit-hash>`  
> **Volver a dev**: `git checkout dev`

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
