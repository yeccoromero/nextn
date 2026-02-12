# 📘 Guía de Usuario (Gestión del Proyecto)

Esta guía explica cómo navegar y entender el estado del proyecto Vectoria sin necesidad de conocimientos técnicos profundos.

## 1. ¿Qué versión funciona?

**La versión que funciona es la que ves.**

*   📂 **Carpeta Raíz** (`/Users/dro-ebru/Downloads/download-v2/`): Contiene el código vivo y la documentación activa. Si un archivo está aquí, es parte del proyecto actual.
*   📄 **PLAN.md**: Es el "Tablero de Control". Ábrelo para ver qué se está construyendo hoy y qué está pendiente.

## 2. Mapa de Carpetas Simplificado

| Carpeta | Descripción | ¿Puedo tocarlo? |
| :--- | :--- | :--- |
| **(Raíz)** | **El Proyecto Activo**. Todo lo que funciona está aquí. | ⚠️ Consulta antes de borrar. |
| `archive/` | **El Archivo**. Documentos antiguos, planes completados y referencias pasadas. | ✅ Sí, es solo lectura/referencia. |
| `src/` | **El Código**. Donde viven la lógica y las pantallas. | ❌ No, solo desarrolladores. |
| `public/` | **Imágenes**. Iconos y recursos visuales. | ✅ Puedes añadir imágenes aquí. |

**Ruta del Archivo**: `/Users/dro-ebru/Downloads/download-v2/archive`

## 3. Mejores Prácticas para el Gestor

1.  **¿Dónde está la documentación antigua?**
    Siempre la moveremos a la carpeta `archive/`. Si buscas un plan antiguo (ej. "Auditoría de Diseño"), búscalo allí.

2.  **¿Cómo sé si algo está terminado?**
    Revisa el archivo `PLAN.md` en la raíz.
    *   `[x]` = Terminado y Funcionando.
    *   `[ ]` = Pendiente.

3.  **Limpieza Automática**
    No te preocupes por el desorden. Cuando terminamos un trabajo, el Agente limpiará la mesa automáticamente por ti, moviendo lo viejo al archivo.

4.  **Regla de Oro**
    Si no sabes qué hace un archivo en la raíz, pregunta a tu Agente antes de moverlo o borrarlo. Muchos archivos "extraños" (como `package.json` o `tsconfig.json`) son los "motores" del proyecto y si se borran, todo deja de funcionar.

---

## 4. Ciclo de Vida: ¿Cómo llega mi cambio a Internet?

Para entender cómo trabajamos, imagina 3 niveles:

### Nivel 1: Tu Ordenador (Local) 💻
*   **Qué es**: Lo que ves en tus carpetas ahora mismo.
*   **Estado**: "Borrador".
*   **Acción**: Aquí hacemos cambios, rompemos cosas y probamos. Nadie más lo ve.

### Nivel 2: La Nube de Pruebas (Rama `dev`) ☁️
*   **Qué es**: Una versión privada en internet para el equipo.
*   **Estado**: "Revisión".
*   **Cómo llegar**: Cuando estás feliz con tu cambio local, el Agente hace un **"Push"** (subida) a esta rama.
*   **Para qué sirve**: Para verificar que todo funciona online antes de lanzarlo al público.

### Nivel 3: Producción (Rama `main`) 🚀
*   **Qué es**: La versión pública que ven los usuarios finales.
*   **Estado**: "Oficial".
*   **Cómo llegar**: Cuando `dev` está perfecto, hacemos un **"Merge"** (fusión) a `main`. Esto dispara una actualización automática en Vercel/Firebase.

### Resumen del Flujo
1.  **Trabajamos Local**: Editamos archivos en tu carpeta.
2.  **Validamos**: Tú dices "ok, funciona".
3.  **Subimos**: El Agente, el Agente guarda en `dev`.
4.  **Publicamos**: Cuando estemos listos, pasamos de `dev` a `main` (Producción).

---

## 5. El Semáforo de Versiones (Riesgo)

Usamos 3 números (ej. `v1.2.3`) que funcionan como un semáforo de riesgo:

*   🔴 **ROJO (El primero: `v1.0.0`)**: **Cambio Mayor**.
    *   Significa: "Hemos cambiado cosas profundas".
    *   Riesgo: Alto. Puede requerir que aprendas algo nuevo o que revises todo.
*   🟡 **AMARILLO (El segundo: `v0.1.0`)**: **Nueva Función**.
    *   Significa: "Hay algo nuevo que probar".
    *   Riesgo: Medio. Lo viejo sigue funcionando igual.
*   🟢 **VERDE (El tercero: `v0.0.1`)**: **Parche**.
    *   Significa: "Arreglamos un error pequeño".
    *   Riesgo: Bajo. Todo debería estar mejor.

## 6. El Botón de Pánico (Rollback)

¿Algo se rompió terriblemente? No te preocupes.

Tenemos una máquina del tiempo llamada `CHANGELOG.md`.

**Cómo usarla:**
1.  Abre el archivo `CHANGELOG.md`.
2.  Busca la última versión donde todo funcionaba bien (ej. `v0.1.0`).
3.  Dime: **"Agente, haz un Rollback a la versión 0.1.0"**.

Yo me encargaré de devolver todo el código exactamente a como estaba en ese momento. **Nada se pierde para siempre.**

## 7. Investigación y Futuro (R&D) 🔬

A veces hacemos investigación técnica profunda para funciones futuras (como "Anime.js Adapter").

*   **¿Para qué sirve?**: Son "Blueprints" o planos arquitectónicos de cosas que construiremos después. No las borres, son el futuro del proyecto.

## 8. Referencia Visual: Keyframes 💎

Guía rápida de los iconos que verás en la línea de tiempo. Cada forma indica cómo se mueve la animación.

| Icono | Nombre | Significado | Comportamiento |
| :---: | :--- | :--- | :--- |
| ♦️ | **Linear** (Rombo) | Velocidad Constante | El cambio es mecánico y uniforme, sin aceleración. |
| ⏹️ | **Hold** (Cuadrado) | Congelado | El valor se mantiene fijo hasta el siguiente punto. (Corte seco). |
| ⏳ | **Ease** (Reloj de Arena) | Suavizado (In/Out) | Forma vertical clásica. Acelera y frena suavemente. |
| <) | **Ease In** (Bala Der) | Llegada Híbrida | Mitad Rombo (Linear In) + Mitad Círculo (Bezier Out). |
| (> | **Ease Out** (Bala Izq) | Salida Híbrida | Mitad Círculo (Bezier In) + Mitad Rombo (Linear Out). |
| ● | **Bezier** (Círculo) | Automático | Curva suave calculada automáticamente por el sistema. |

> **Nota Visual**: Las formas híbridas ("Balas") combinan lo mejor de dos mundos:
> *   **<) Bala Derecha**: Entra recto (Linear), sale curvo (Bezier).
> *   **(> Bala Izquierda**: Entra curvo (Bezier), sale recto (Linear).
