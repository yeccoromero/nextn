# Changelog

Todos los cambios notables en este proyecto se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [0.2.0] - 2026-02-07

### Añadido
- **Editor de Gráficos (Graph Editor)**: Implementación completa con modos de Velocidad y Valor.
- **Marquee Selection**: Selección de múltiples keyframes mediante arrastre en el editor.
- **Tangentes Suaves (Smooth Tangents)**: Soporte para tangentes continuas y rotas en curvas Bezier.
- **Inputs Numéricos**: Control preciso de influencia y valores en el toolbar.

### Corregido
- **Portapapeles (Clipboard)**: Ahora preserva la interpolación (Ease/Bezier) y puntos de control al copiar/pegar keyframes.
- **UI del Graph Editor**: Refactorización completa usando componentes estándar (`Button`, `Input`, `Popover`) para consistencia visual.
- **Navegación**: Reparada la interacción de botones en el toolbar que no respondían a clics.

### Cambiado
- **Estructura**: Limpieza de archivos raíz y archivado de planes obsolestos.

---
*Verificación de Integración Vercel: Test Commit*

---

## [0.1.0] - 2026-02-07

### Añadido
- **GUIA_USUARIO.md**: Guía simplificada para la gestión no técnica del proyecto.
- **WORKFLOW.md**: Protocolo técnico de desarrollo y versionado.
- **CHANGELOG.md**: Este archivo para registrar la historia del proyecto.
- **Carpeta `archive/`**: Para almacenar documentación antigua y mantener la raíz limpia.

### Cambiado
- **PLAN.md**: Actualizado para referenciar los nuevos protocolos (`WORKFLOW.md`).
- **README.md**: Añadido enlace directo a la Guía de Usuario.
- **Limpieza**: Movido `DESIGN_AUDIT.md` a la carpeta `archive/`.

---
*Tip: Si necesitas volver a este punto en el futuro, pide al Agente: "Rollback a versión 0.1.0"*
