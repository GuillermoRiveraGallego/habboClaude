# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Mantenimiento de este archivo**: al terminar cualquier cambio que altere lo aquí documentado — un módulo nuevo, un cambio en el orden de carga, un campo nuevo en el estado guardado, una convención nueva o un modo de prueba nuevo — actualiza la sección correspondiente de este CLAUDE.md en el mismo commit. No añadas detalles triviales que se descubren leyendo el código; solo lo que una sesión futura necesitaría saber de antemano.

## Qué es este proyecto

"Habbo de un jugador": juego de decorar salas y coleccionar muebles con vista isométrica, un solo jugador, 100% local. Todo el arte se dibuja por código en canvas (sin imágenes ni dependencias). El documento de diseño completo está en `DISEÑO.md` y el roadmap de ideas en `ideasGuilleFuturas.md` (implementadas: jardín/mascotas, ordenador con minijuegos, jardinería, ciclo día/noche, personalización del avatar; pendientes: cuadros personalizados dibujables y la playa).

**Todo el código, comentarios, nombres e interfaz están en español.** Mantener esa convención en cualquier código nuevo.

## Cómo ejecutar y probar

No hay build, ni npm, ni framework de tests. Es HTML + JS + CSS puro que funciona con `file://`:

- **Jugar**: abrir `index.html` en el navegador.
- **Revisar el catálogo visualmente**: abrir `catalogo.html` (renderiza todos los furnis en miniatura).
- **Modos de prueba**: `index.html?prueba=<modo>`. En modo prueba se arranca con partida limpia y sin guardar (salvo los modos `e2e*`), así que no toca la partida real del jugador.
  - Flujos automatizados que pintan OK/FALLO en pantalla: `flujo` (decoración y economía), `jardin_flujo` (mascotas), `ordenador_flujo` (minijuegos), `avatar_flujo` (personalización), `guardado_flujo` (persistencia y migración), `ambiente_flujo` (día/noche), `responsive_flujo` (lienzo adaptable al tamaño de ventana), `npcs_flujo` (NPCs y chat), `tareas_flujo` (tareas diarias y desbloqueos), `baile_flujo` (sala de baile), `casino_flujo` (casino: zona exclusiva, juegos de apuestas y NPCs de ambiente).
  - Escenas para capturas: `catalogo`, `inventario`, `salas`, `fantasma`, `fantasma_mal`, `fantasma_pared`, `seleccion`, `jardin`, `jardin_triste`, `mascota`, `tienda`, `panel_mascotas`, `ordenador`, `ordenador_<juego>`, `avatar`, `avatar_look`, `avatar_look2`, `fase_<manana|tarde|atardecer|noche>`, `npc_chat`, `visita`, `tareas`, `baile`, `casino`, `casino_<dados|ruleta|tragaperras|blackjack>`, `e2e1`/`e2e2` (guardado con recarga real).
  - Al añadir una feature nueva, añadir su modo `<feature>_flujo` y sus escenas de captura en el script inline de `index.html` — es el mecanismo de test del proyecto.
- Para verificar visualmente, abrir estas URLs con un navegador (p. ej. Playwright/captura) y comprobar los OK/FALLO del recuadro.

## Arquitectura

**Sin módulos ES** (para que funcione con `file://`): scripts clásicos cargados en orden en `index.html`, cada uno es un IIFE que expone un objeto global. El orden de carga es una cadena de dependencias — respetarlo al añadir módulos:

```
paleta.js → iso.js → furnis.js → avatar.js → juego.js → mascotas.js
→ npcs.js → tareas.js → sala.js → ui.js → minijuegos.js → casino.js → guardado.js → ambiente.js
```

| Global | Responsabilidad |
|---|---|
| `Paleta` | Paleta cerrada de 20 colores con 3 variantes precalculadas (`sup`/`izq`/`der`). Un nombre fuera de paleta pinta magenta y avisa por consola. |
| `Iso` | Proyección isométrica y primitivas (`cubo`, `plano`, `cilindro`). **Toda la luz vive aquí**: las primitivas asignan las variantes a sus caras; nadie elige el sombreado. |
| `Furnis` | Catálogo completo (~98 muebles). Cada furni se dibuja SOLO con primitivas vía el `Pincel`, en coordenadas locales con rot 0; el pincel aplica rotación y ordena piezas. La misma función `dibujar` sirve en sala, catálogo e inventario. |
| `Avatar` | Personaje voxel + poses (andar, sentado, tumbado). Lee su aspecto de `Juego.estado().avatar` vía `ponAspecto()`. |
| `Juego` | **Único dueño del estado persistente** (créditos, salas, inventario, mascotas, minijuegos, casino, avatar, ambiente). Toda mutación llama a `cambio()`, que notifica a los oyentes (autoguardado, UI). |
| `Mascotas` | Lógica del jardín: stats (hambre/felicidad/energía), tick de decaimiento, compra, hogares (acuario/aviario), recompensas. |
| `Npcs` | NPCs basados en datos, en tres listas: FIJOS (uno por sala, por índice de sala), VISITANTES ("de visita": una rotación determinista por número de día decide quién aparece y en cuál de sus puestos, con días sin visita; `forzarVisita(id\|null\|undefined)` lo controla en pruebas) y CASINO (ambiente: viven en la sala de tipo `"casino"` sea cual sea su índice, con conductas `crupier`/`paseante`/`cliente_bar`, estados esperando/caminando/jugando/sentado que rotan con temporizadores — `Sala` llama a `tickCasino(dt, ctx)` cada frame — y frases predefinidas en burbuja). Se dibujan con el cuerpo del `Avatar` (intercambio temporal de aspecto) y conversan por palabras clave normalizadas (sin acentos ni diacríticos — algunos hablan rumano) con genéricas aleatorias de respaldo. Sin estado persistente. |
| `Tareas` | Tareas diarias basadas en datos. Los módulos avisan con `Tareas.evento(tipo, dato)` (`"minijuego"`, `"gasto"`, `"npc"`, `"sala"`, `"mascota"`); el estado vive en `Juego.estado().tareas` y se reinicia solo al cambiar de día. Reclamar paga créditos y puede desbloquear claves de `Juego.recompensas()` (furnis o habilidades como `bailar`). |
| `Sala` | Motor: render con orden de pintado `(x+y)` ascendente, rejilla de bloqueo derivada, A*, modo decoración con fantasma, bucle `requestAnimationFrame`. |
| `UI` | HUD, panel lateral (catálogo/inventario/salas/mascotas/avatar), menú de furni, avisos. Orquesta `Juego` (estado) y `Sala` (motor). |
| `Minijuegos` | Modal del ordenador fijo del Salón: 5 juegos con enfriamiento de 90 s (arranca al INICIAR la partida). |
| `Casino` | Modal de los juegos de apuestas del casino (dados, ruleta europea, tragaperras, blackjack; el póker es decorativo: la UI avisa "Póker próximamente"). Sistema común: selector de apuesta compartido, `Juego.apostarCasino(n)` cobra por adelantado y `Juego.premioCasino(n)` abona el premio TOTAL (apuesta × multiplicador) disparando `cambio()` → autoguardado. La lógica de cada juego es pura (`resolverDados/Ruleta/Tragaperras`, `valorMano`) con azar real de `Math.random()`, y está expuesta para `casino_flujo`. Se abre al pulsar un furni con `def.juegoCasino` en modo pasear. |
| `Guardado` | localStorage, clave `habbo_solo_v1`, con debounce de 400 ms + intervalo de 10 s + `beforeunload`. |
| `Ambiente` | Ciclo día/noche: 4 fases que tiñen la paleta entera; por defecto sigue la hora real (`"auto"`). De noche/atardecer los furnis con `def.luz` dibujan halo. |

El arranque y el cableado de todo está en el `<script>` inline al final de `index.html`. La interfaz es responsive: el arranque escucha `resize` y llama a `Sala.redimensionar()` (re-encuadra el lienzo), y publica la variable CSS `--alto-hud` (altura real del HUD) de la que cuelga la posición del panel lateral; en pantallas estrechas los botones del HUD ocultan su `<span class="etiqueta">` y quedan solo con el emoji.

### Reglas del estado y guardado

- **Persistente vs efímero**: lo que debe sobrevivir a una recarga vive en `Juego.estado()`; posiciones de mascotas, animaciones y caminos son efímeros y viven en cada módulo (se regeneran, nunca se guardan).
- Algunas cosas mutan sin pasar por `Juego` (furnis colocados en `sala.furnis`, stats de mascotas) — por eso existe el guardado de red de seguridad cada 10 s.
- **Migración**: `Juego.migrar()` rellena defensivamente campos que falten en partidas antiguas. Al añadir un campo nuevo al estado, añadirlo a `nuevaPartida()` y comprobar que `migrar()` lo cubre (los objetos anidados nuevos hay que añadirlos a su lista explícita). El campo `version` solo cambia en roturas incompatibles.
- El ordenador del Salón es un furni con `fijo: true`: no se puede vender, guardar, mover ni rotar, y la migración garantiza que siempre exista (igual que el jardín).

### Convenciones del sistema visual (contrato — no romper)

- Los furnis referencian colores **por nombre de paleta**, nunca por hex.
- 1 casilla = 64×32 px; todo se define en múltiplos de **media casilla** (0.5) en x/y/z. Alturas de referencia: asiento 0.5, mesa 1.0, respaldo 1.25, estantería 2.0.
- `rot`: 0=+x, 1=+y, 2=−x, 3=−y (los de 2 rotaciones usan {0,1}).
- Definición de furni: `{ id, nombre, categoria, precio, tam: [an, fo], rotaciones, sentable, bloquea, capa: "furni"|"alfombra"|"pared", dibujar(pincel) }`. Máximo un furni de capa `furni` por casilla; las alfombras coexisten debajo; los de pared se anclan a una pared (`{pared: "x"|"y", slot}`) sin ocupar suelo.
- El jardín es una sala con `tipo: "jardin"` (seto bajo en lugar de pared; las mascotas solo viven ahí). La sala de baile es `tipo: "baile"`: pista central animada (margen de 2 casillas) dibujada en el bucle de `Sala`; con la habilidad `bailar` desbloqueada el avatar baila solo al quedarse quieto en la pista. El casino es `tipo: "casino"`: moqueta verde con borde de madera y zócalo dorado dibujados por `Sala` (sus colores no se personalizan), y **zona exclusiva de mobiliario**: los furnis con `zona: "casino"` solo se colocan allí y el resto no puede entrar (lo validan `Sala.validar`/`validarPared` y lo filtran catálogo e inventario de la UI). La migración conserva el orden de las salas (baile se inserta antes del casino) porque los NPC fijos dependen del índice de sala.
- Furnis de recompensa: `recompensa: true` + `desbloqueo: "texto de cómo conseguirlo"`. Aparecen bloqueados (🔒) en el catálogo hasta que su id sea `true` en `Juego.recompensas()` (los desbloquean las mascotas felices o el reclamo de tareas).
- Estilo de código: `"use strict"`, ES5 (`var`, funciones clásicas), IIFEs con API pública explícita en el `return`, comentarios de cabecera en bloque explicando el módulo.
