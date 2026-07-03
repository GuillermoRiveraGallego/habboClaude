# Habbo de un Jugador — Documento de Diseño y Arquitectura (Fase 0)

## 1. Visión general

Juego de decorar salas y coleccionar muebles con vista isométrica, un solo jugador,
100% local. Un único `index.html` + JS/CSS sin dependencias ni imágenes: todo el
arte se dibuja por código en canvas usando primitivas isométricas con una paleta
cerrada. Guardado automático en `localStorage`.

## 2. Estructura de archivos

```
index.html          Punto de entrada del juego
catalogo.html       Página de prueba: renderiza el catálogo completo (revisión visual)
css/estilo.css      UI (paneles, botones) coherente con la paleta
js/
  paleta.js         Paleta cerrada + variantes de sombreado precalculadas
  iso.js            Matemáticas isométricas (mundo↔pantalla) y primitivas (cubo, plano, cilindro)
  furnis.js         Definición de los 40+ furnis (solo con primitivas)
  avatar.js         Dibujo y animación del avatar + poses (andar, sentado, tumbado)
  sala.js           Motor de sala: render, orden de pintado, pathfinding A*
  juego.js          Estado global, economía, misiones, NPCs, rotación de raros
  ui.js             Catálogo, inventario, modo decoración, diálogos
  guardado.js       Serialización a localStorage + migración de versiones
```

Sin módulos ES (para que funcione con `file://`): scripts clásicos en orden, cada
uno expone un objeto global (`Paleta`, `Iso`, `Furnis`, …).

## 3. Sistema visual (contrato de la Fase 1)

- **Paleta cerrada de ~20 colores base.** Cada color se precalcula en 3 variantes:
  `sup` (cara superior, clara), `izq` (lateral, media), `der` (frontal, oscura).
  Los furnis referencian colores por nombre (`"madera"`, `"rojo"`), nunca por hex.
- **Luz única global**: implementada dentro de las primitivas — quien dibuja un
  cubo no elige el sombreado, solo el color base. Imposible romper la coherencia.
- **Unidad de medida**: 1 casilla = 64 px de ancho isométrico × 32 px de alto.
  Todos los muebles se definen en múltiplos de **media casilla** (0.5) en X, Y y Z.
  Altura de referencia: asiento = 0.5, mesa = 1.0, respaldo = 1.25, estantería = 2.0.
- **Primitivas**: `cubo(x, y, z, ancho, fondo, alto, color)`, `plano(...)`,
  `cilindro(...)`. Todas reciben coordenadas de mundo y resuelven proyección y
  sombreado internamente.

## 4. Estructuras de datos

### 4.1 Catálogo de furnis (estático, en código)

```js
{
  id: "mesa_ordenador",
  nombre: "Escritorio con ordenador",
  categoria: "mesas",           // mesas | sillas | camas | sofas | alfombras | plantas | almacenaje | electro | iluminacion | pared
  precio: 120,
  tam: [2, 1],                  // casillas que ocupa (ancho × fondo) en rotación 0
  rotaciones: 4,                // 2 o 4
  sentable: null,               // null | "sentado" | "tumbado" (con altura de asiento)
  bloquea: true,                // false en alfombras y cuadros
  capa: "furni",                // "alfombra" | "furni" | "pared"
  raro: false,                  // true → solo aparece en la rotación diaria
  dibujar(ctx, x, y, rot)       // compone primitivas; único punto de dibujo
}
```

El **dibujo del furni es también su miniatura**: la misma función `dibujar` se usa
en sala, catálogo e inventario (renderizada a un canvas pequeño), garantizando
consistencia.

### 4.2 Sala

```js
{
  id: "sala1",
  nombre: "Mi primera sala",
  ancho: 10, fondo: 10,
  colorSuelo: "beige",          // nombre de paleta
  colorPared: "azul_claro",
  desbloqueada: true,
  furnis: [                     // lista, no matriz: facilita mover/serializar
    { uid: 17, id: "silla_roja", x: 3, y: 4, rot: 1 },
    ...
  ]
}
```

- `uid` es un contador global autoincremental (identifica la instancia concreta).
- Reglas: máximo un furni de capa `furni` por casilla; una alfombra puede coexistir
  debajo; los `pared` se anclan a una pared y no ocupan suelo.
- En runtime la sala mantiene una **rejilla derivada** (ocupación y bloqueo) para
  A* y validación de colocación; se reconstruye desde la lista, nunca se guarda.

### 4.3 Jugador y progreso

```js
{
  creditos: 500,
  inventario: [ { uid: 22, id: "planta_helecho" }, ... ],  // furnis comprados sin colocar
  salaActual: "sala1",
  logros: { "primer_furni": true, ... },
  misiones: { "tema_oficina": { completada: false } },
  estadisticas: { furnisComprados: 12, creditosGanados: 900, visitasNPC: 4 },
  diaSemilla: 20260703            // para la rotación diaria de furnis raros
}
```

### 4.4 Guardado (localStorage, clave única `habbo_solo_v1`)

```js
{ version: 1, jugador: {...}, salas: [ {...}, {...}, {...} ] }
```

- Autoguardado tras cada acción que muta estado (comprar, colocar, vender, ganar
  créditos…), con `try/catch` y aviso si falla.
- Campo `version` para migraciones futuras. Botón de "reiniciar partida" en ajustes.

## 5. Motor de sala (resumen técnico)

- **Orden de pintado**: paredes → suelo → por casilla en orden `(x + y)` ascendente:
  alfombra, furni, avatar/NPC si está en esa casilla. Los furnis multicasilla se
  pintan en su casilla más lejana a cámara ocupada.
- **Pathfinding**: A* sobre la rejilla de bloqueo con movimiento en 8 direcciones
  (diagonales solo si no cortan esquinas). Click en furni sentable → caminar a
  casilla adyacente y sentarse/tumbarse con la pose y orientación del mueble.
- **Bucle**: `requestAnimationFrame` con interpolación del avatar entre casillas.

## 6. Economía y juego en solitario

- **Minijuegos** (ganan créditos, con enfriamiento para no farmear infinito):
  1. *Memoria de furnis*: parejas de miniaturas del catálogo.
  2. *Reflejos*: pulsa la casilla que se ilumina en la sala, cada vez más rápido.
  3. *Adivina el precio*: ¿más caro o más barato? con furnis del catálogo.
- **Logros** con recompensa única (primer furni, 10 furnis, sala llena, etc.).
- **NPCs**: 4-5 personajes con nombre y personalidad (pijo, friki, abuela, artista…).
  Visitan salas con temporizador, pasean con el mismo A*, se sientan, y comentan
  según *tags* de lo colocado ("¡Qué pasada de tele!" si hay `electro`).
- **Misiones de decoración**: condiciones sobre el contenido de una sala
  (ej. oficina = escritorio + silla + estantería + planta en la misma sala).
- **Furnis raros**: subconjunto del catálogo marcado `raro`; cada día (semilla =
  fecha) aparecen 2-3 en el catálogo a precio alto. Coleccionismo.

## 7. Interfaz

- Canvas central; barra inferior de juego (créditos, botones de catálogo,
  inventario, salas, misiones, minijuegos); panel lateral deslizante para
  catálogo/inventario con miniaturas renderizadas y pestañas por categoría.
- Modo decoración: furni fantasma semitransparente siguiendo el cursor, verde/rojo
  según validez; `R` o botón para rotar; click derecho o `Esc` cancela.
- Estética "de juego": bordes redondeados, colores de la paleta, tipografía
  rechoncha, sin apariencia de página web.

## 8. Orden de construcción

Fase 1 (paleta + primitivas + sala de muestra con 5 furnis + página catálogo) →
**validación de estilo contigo** → Fase 2 (motor de sala, avatar, A*, sentarse,
rotación) → Fase 3 (catálogo 40+, decoración, multi-sala, colores) → Fase 4
(economía, NPCs, misiones, raros, guardado) → auto-prueba completa y propuesta v2.
