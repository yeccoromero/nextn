# Guía de Keyframes: Tipos, Nomenclatura y Uso

R: Rotación (Rotation)
T: Opacidad (Opacity - viene de Transparency)
U: Revela todos los parámetros que tienen keyframes activos.
Alt + Shift + [Letra de propiedad]: Crea un keyframe manualmente en el punto de la línea de tiempo.

## 📋 Tipos de Keyframes y Nomenclatura

| Icono / Forma | Nombre Técnico | Cómo funciona / Qué hace | Cuándo usarlo |
| :--- | :--- | :--- | :--- |
| Rombo ♦️ | Linear (Lineal) | Cambio constante a una velocidad uniforme. Es mecánico. | Para movimientos robóticos o de fondo que no requieren "alma". |
| Reloj de arena ⏳ | Easy Ease (F9) | Suaviza la entrada y la salida. El objeto acelera y desacelera. | Es el estándar para que cualquier movimiento se vea natural. |
| Círculo ● | Auto Bezier | After ajusta la curva automáticamente para evitar saltos bruscos. | Cuando mueves un objeto por una ruta curva compleja. |
| Cuadrado ⏹️ | Hold (Mantener) | Congela el valor hasta que llega al siguiente keyframe. No hay transición. | Para cortes directos, cambios de color súbitos o efectos de "stop motion". |
| Flecha plana ⧖ | Ease In / Out | Suaviza solo la llegada (In) o solo la salida (Out). | Para objetos que aterrizan suavemente o despegan con fuerza. |

## ⚙️ Cómo "deben" funcionar (La regla de oro)

Un keyframe no es solo un punto; es una instrucción de tiempo.

*   **Interpolación Temporal**: Es el "cuándo". Si los puntos están lejos, el movimiento es lento; si están cerca, es rápido.
*   **Interpolación Espacial**: Es el "por dónde". Define si el objeto se mueve en línea recta o en curva (puedes ajustar esto con las "manecillas" en el visor).
*   **El Editor de Gráficos**: Para que un keyframe funcione de verdad, debes usar el Graph Editor de After Effects. Ahí es donde conviertes un movimiento aburrido en algo profesional ajustando la influencia (las curvas de velocidad).

## 🚀 Truco Pro: Keyframes Itinerantes (Roving Keyframes)

Si tienes muchos puntos en una trayectoria y quieres que la velocidad sea constante sin importar la distancia entre ellos, selecciona los del medio, clic derecho y elige "Rove Across Time". Se convertirán en pequeños puntos redondos que se ajustan solos.

---

## 📐 Keyframes de Dirección (Incoming / Outgoing)

| Icono / Forma | Nombre | Hotkey | Función y Comportamiento |
| :--- | :--- | :--- | :--- |
| Flecha derecha ⧗ (D-shape) | Easy Ease Out | Ctrl + Shift + F9 | **Qué hace:** Suaviza la salida. El objeto arranca lento y va ganando velocidad.<br>**Uso:** Cuando algo empieza a moverse desde el reposo (ej. un auto arrancando). |
| Flecha izquierda ⧖ | Easy Ease In | Shift + F9 | **Qué hace:** Suaviza la llegada. El objeto viene rápido y frena suavemente al final.<br>**Uso:** Cuando un elemento aterriza en su posición final (ej. un logo que entra a cuadro). |

### 💡 ¿Cómo deben funcionar y cómo se interpretan?

Estos keyframes son unidireccionales. A diferencia del Easy Ease (F9), que suaviza ambos lados, estos se usan para tener control total sobre un solo extremo del movimiento:

*   **Nomenclatura Interna**: En el Keyframe Interpolation de Adobe, se les conoce como ajustes de Influencia.
*   **El "Truco" Visual**:
    *   Si ves la punta plana hacia la izquierda, significa que la transición hacia ese punto es lineal, pero la salida es suave.
    *   Si ves la punta plana hacia la derecha, significa que la entrada es suave, pero lo que sigue después es lineal.
*   **Combinación Ganadora**: Se suelen usar mucho en el Motion Graphics moderno para crear "aceleraciones agresivas". Por ejemplo: Usas un Ease Out al inicio y un Ease In al final, pero abres el Graph Editor de After Effects para estirar las palancas y que el objeto "vuele" en el medio.

### 🛠️ Resumen de comandos para no olvidar:

*   **F9**: Suave ambos lados (Reloj de arena).
*   **Shift + F9**: Suave al llegar (Entrada).
*   **Ctrl + Shift + F9**: Suave al salir (Salida).
*   **Ctrl + Clic en el keyframe**: Lo devuelve a Linear (Rombo).
