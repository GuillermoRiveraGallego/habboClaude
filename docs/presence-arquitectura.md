# Presence / Multijugador — Documento de arquitectura (Fase P3)

> **Estado de este documento**: SOLO diseño. No hay código funcional, ni conexión
> Realtime, ni cambios en el SQL de Supabase todavía. Es el equivalente para la
> fase de Presence de lo que fue la planificación por tareas (T1–T5) de la
> migración a Supabase: define el terreno antes de tocar nada.
>
> **Cómo leerlo**: primero el objetivo y el modelo temporal/persistente; luego la
> distinción propietario/visitante (es la que gobierna todo); después los detalles
> de canal, estado, ciclos de vida y transporte; y al final los módulos nuevos,
> los riesgos y el desglose de tareas P3.2 en adelante.

---

## 1. Objetivo de Presence

Permitir que un jugador **visite la sala de otro jugador** y vea, en tiempo real,
a los demás avatares presentes en esa misma sala: dónde están, hacia dónde miran,
si caminan, bailan o se sientan, y qué dicen por el chat.

El visitante es un **espectador con presencia física**: existe en la sala, se
mueve y socializa, pero **no puede alterar nada del mundo del propietario**.

Acciones permitidas al visitante (todas puramente visuales/efímeras):

- caminar por la sala (pathfinding local, igual que hoy);
- cambiar de dirección;
- chatear;
- bailar (si tiene la habilidad desbloqueada en SU partida);
- sentarse en los muebles sentables del propietario;
- interactuar visualmente (emotes, burbujas), sin efecto sobre el estado del dueño.

Acciones **prohibidas** al visitante:

- colocar, mover, rotar, vender o guardar muebles;
- cambiar colores, comprar, desbloquear salas;
- tocar inventario, créditos, tareas, mascotas o cualquier progreso del dueño;
- disparar minijuegos/casino que muevan la economía del dueño.

Esto ya está respaldado por el backend: el esquema `supabase/T1_esquema.sql` se
diseñó con la **frontera público/privado** pensando en esta fase —
`profiles` y `salas` son de **lectura pública**, `salas` es de **escritura solo
del dueño**, y `partidas` es **privada total**. Presence se apoya en esa frontera;
no la cambia.

---

## 2. Qué será temporal y qué será persistente

Es la regla más importante de la fase y extiende la ya vigente en el juego
("persistente vive en `Juego.estado()`; lo efímero vive en su módulo y se
regenera"). Presence añade una tercera categoría: **efímero compartido por red**.

| Categoría | Ejemplos | Dónde vive | Se guarda |
|---|---|---|---|
| **Persistente (privado)** | créditos, inventario, tareas, mascotas, casino, `salaActual` | `partidas.estado_privado` | Sí (ya) |
| **Persistente (público)** | decorado de cada sala (`salas.furnis`), aspecto del avatar (`profiles.avatar`), nombre (`profiles.display_name`) | tablas `salas` / `profiles` | Sí (ya) |
| **Efímero local** | posición/dirección/pose del avatar propio, caminos A\*, animaciones | módulos (`Sala`, `Mascotas`, `Npcs`) | No (ya) |
| **Efímero compartido (NUEVO)** | posición/dir/pose de jugadores **remotos**, mensajes de chat, emotes, quién está en la sala | canales Realtime, runtime del futuro módulo `Remotos` | **Nunca** |

**Consecuencia de diseño**: Presence **no toca el guardado**. El módulo `Guardado`
y los backends (`AlmacenLocal`, `AlmacenNube`) quedan **exactamente como están**.
Nada de lo que viaja por Realtime se persiste; nada de lo que se persiste depende
de que haya red multijugador. Si Realtime falla, el juego es idéntico al de hoy.

---

## 3. Diferencia entre propietario y visitante

La sala que se pinta en pantalla pertenece **siempre a un propietario** (el dueño
de esa fila de la tabla `salas`). El jugador que la mira es el **propietario** (su
propia sala) o un **visitante** (la sala de otro).

|  | Propietario | Visitante |
|---|---|---|
| Origen de los datos de la sala | su `Juego.estado().salas[i]` (local) | lectura de `salas` del dueño vía `Nube` (solo SELECT) |
| Modo decorar | disponible | **deshabilitado** (ni botón ni fantasma) |
| Escritura de muebles/colores | sí (RLS lo permite) | **imposible** (RLS lo rechaza aunque el cliente lo intentara) |
| Su avatar | es el "local" de `Sala` | es el "local" de `Sala`, pero en sala ajena |
| Otros avatares | visitantes que entran | el propietario + otros visitantes |
| Economía / progreso | la suya | la suya (nunca la del dueño) |

**Clave de identidad de sala**: una sala no se identifica solo por su índice, sino
por **dueño + índice**. La tabla `salas` tiene la clave natural
`unique (user_id, indice)`. Por tanto el identificador canónico de sala para
Presence es:

```
salaId = "<owner_user_id>:<indice>"
```

- El **propietario** de la sala 0 y un **visitante** de la sala 0 de esa persona
  comparten el mismo `salaId` y, por tanto, el mismo canal.
- La sala 0 de dos usuarios distintos son canales **distintos** (distinto
  `owner_user_id`), como debe ser.

La distinción propietario/visitante es una **capa de la UI y del cargador de
sala**, no del motor `Sala`: el motor seguirá recibiendo un objeto de sala con
`{ancho, fondo, tipo, colorSuelo, colorPared, furnis}`; le da igual de quién sea.
Lo que cambia es (a) de dónde salió ese objeto y (b) si se permite entrar en modo
decorar.

---

## 4. Canal previsto por sala

Un canal de Realtime **por sala visitable**:

```
presence:sala:<salaId>   →   presence:sala:<owner_user_id>:<indice>
```

- Al **entrar** en una sala (propia o ajena), el cliente se suscribe a ese canal.
- Al **salir** (cambiar de sala, volver a la suya, cerrar), se **desuscribe**.
- **Un solo canal activo a la vez** por cliente (siempre estás en una sola sala).
  Cambiar de sala = `unsubscribe` del anterior + `subscribe` del nuevo.

El canal transporta **dos cosas distintas** (ver §12):

1. **Presence** (roster con estado): quién está y su último estado conocido.
2. **Broadcast** (eventos): movimiento de alta frecuencia, mensajes de chat, emotes.

**Todo el acceso al canal pasa por `Nube`** (`js/services/supabase.js`), igual que
hoy todo el acceso a Supabase pasa por ahí. Ningún otro módulo tocará
`window.supabase` ni `cliente().channel(...)` directamente. `Nube` ganará una capa
de canal (ver §13 y P3.2) con una API defensiva: si Supabase no está disponible o
no hay sesión, las funciones no rompen y el juego sigue en modo un jugador.

---

## 5. Estado mínimo a publicar

Cuanto menos se publique, mejor (tráfico, privacidad y superficie de abuso). El
estado de presencia de un jugador es prácticamente lo que ya tiene el avatar del
motor `Sala` más su identidad pública:

```jsonc
{
  "uid":     "<user_id>",       // identidad (para de-duplicar y resolver perfil)
  "nombre":  "Guille",          // profiles.display_name (cache; ver nota)
  "aspecto": {                  // profiles.avatar (aspecto voxel)
    "peinado": "...", "pelo": "...", "piel": "...",
    "camiseta": "...", "pantalon": "...", "zapatos": "..."
  },
  "x":   4.5,                   // posición continua (casillas)
  "y":   3.5,
  "dir": 1,                     // 0=+x 1=+y 2=−x 3=−y
  "pose": "andando",            // "parado"|"andando"|"sentado"|"tumbado"|"bailando"
  "destino": { "x": 6, "y": 2 } // opcional: hacia dónde va (permite interpolar sin spamear)
}
```

Notas de diseño:

- **`aspecto` y `nombre` son públicos por diseño** (`profiles`). Publicarlos en el
  presence-state evita que cada cliente tenga que consultar `profiles` por cada
  vecino, pero se puede optimizar publicando solo `uid` y **resolviendo el perfil
  una vez** contra `profiles` con una pequeña caché (`Directorio`/`Perfiles`). La
  decisión final (payload gordo vs. `uid` + caché) se toma en P3.4 midiendo tamaño.
- **`pose`, `dir`, `x`, `y`** son exactamente los campos del `avatar` interno de
  `Sala` (líneas del objeto `avatar`), así que el remoto se dibuja con el mismo
  `Avatar.dibujar` sin adaptaciones.
- **`fase`** (fase de animación de andar/bailar) **no se publica**: es cosmética y
  se regenera localmente en el receptor a partir de `pose` (como hacen ya los NPCs
  del casino con su `rt.fase`).
- **`gz`** (altura al sentarse) tampoco se publica: se deriva del mueble en el que
  se sienta más `pose === "sentado"`.

---

## 6. Qué datos NO deben publicarse

Nunca deben salir por el canal (ni presence ni broadcast):

- **Nada de `partidas.estado_privado`**: créditos, inventario, `sigUid`, comida,
  recompensas, tareas, datos de minijuegos, contadores del casino, mascotas.
- **`salaActual`** como valor de progreso (el canal ya implica en qué sala estás;
  no hace falta anunciar el índice privado del dueño).
- **Posición a cada frame**: se emite con throttle / por destino (ver §10 y §11).
- **Tokens, email, claves, JWT**: jamás. La sesión la gestiona supabase-js.
- **Cualquier dato en el que el receptor "confíe" para escribir**: el broadcast es
  **no confiable** (cualquiera en el canal puede emitir lo que quiera). Solo se usa
  para pintar avatares y burbujas, nunca para mutar estado. La integridad de la
  escritura la garantiza **RLS**, no el cliente.

Regla mental: *el canal solo mueve píxeles y texto de chat; el dinero y los muebles
solo se mueven por la DB, con RLS de por medio.*

---

## 7. Ciclo de entrada en sala

Cuando el jugador entra en una sala (la suya al arrancar, o la de otro al visitar):

1. **Cargar el decorado**:
   - Si es **propia**: el objeto de sala sale de `Juego.estado().salas[i]` (como hoy).
   - Si es **ajena**: `Nube` lee la fila de `salas` del dueño (SELECT público) y la
     traduce a un objeto de sala con la función pura que ya existe
     (`AlmacenNube.filaASala`, reutilizable). Se pasa a `Sala.cargar(objeto)`.
2. **Fijar el modo**: propia → decorar disponible; ajena → forzar modo pasear y
   ocultar la entrada a decorar (capa de UI).
3. **Suscribirse al canal** `presence:sala:<salaId>` vía `Nube`.
4. **`track`** el estado inicial propio (posición de entrada, aspecto, nombre).
5. **Recibir el roster** (`sync`): la lista de quién ya estaba → crear sus runtimes
   remotos en el módulo `Remotos`.
6. A partir de ahí, escuchar `join`/`leave` (altas/bajas) y los eventos de
   broadcast (movimiento/chat).

El propietario que está en su sala **también** se suscribe: así ve entrar y salir a
las visitas y puede chatear con ellas.

---

## 8. Ciclo de salida

Cuando el jugador abandona la sala (cambia de sala, vuelve a la suya, navega fuera):

1. **`untrack`** el estado propio (se retira del roster de los demás).
2. **`unsubscribe`** del canal actual.
3. **Limpiar** el runtime de remotos de esa sala (se descarta; es efímero).
4. Si va a otra sala visitable, repetir el ciclo de entrada con el nuevo `salaId`.

`Sala.cargar()` ya resetea todo el estado efímero del motor al cambiar de sala; la
parte nueva es el `untrack`/`unsubscribe`, que **debe** ejecutarse antes de suscribir
el canal siguiente para no quedar en dos canales a la vez.

---

## 9. Cierre de navegador / pérdida de conexión

- **Cierre / recarga de pestaña**: engancharse a `beforeunload` y
  `visibilitychange` (el juego ya los usa para guardar) para llamar a `untrack`.
  Aun si no da tiempo, Supabase Presence **retira automáticamente** al cliente
  cuando el WebSocket se cae (heartbeat), así que los demás lo verán salir en
  segundos aunque el `untrack` explícito no llegue.
- **Pérdida de conexión**: supabase-js reintenta la conexión. Al reconectar hay que
  **re-suscribir el canal y re-`track`** el estado actual. `Nube` centralizará esa
  reconexión para que los módulos no la gestionen.
- **Fantasmas** (avatares que quedan sin dueño porque su baja se perdió): mitigación
  por **timeout de última actividad** en el receptor — si un remoto no emite nada en
  N segundos, se desvanece localmente. Presence de Supabase ya cubre el caso normal;
  el timeout es la red de seguridad.
- **Degradación elegante**: sin sesión o sin Realtime, no hay canal, no hay remotos,
  y el juego funciona como un jugador. Es el mismo principio defensivo de `Nube` hoy.

---

## 10. Estrategia de movimiento

El avatar local ya se mueve con pathfinding A\* y un `camino` de casillas
interpolado a `VEL_AVATAR` (ver `Sala.actualizar`). Para la red **no se retransmite
el movimiento continuo frame a frame**; se retransmite la **intención**:

- Cuando el jugador local fija un destino (click → `iniciarCamino`), se emite un
  evento de broadcast con **posición actual + destino** (y `pose: "andando"`).
- El receptor **recalcula o interpola** el trayecto hacia ese destino con su propia
  velocidad, exactamente como el casino ya mueve a sus NPCs paseantes
  (`tickCasino`: interpola `rt.px/py` hacia el objetivo y anima la pose).
- Al llegar, o al cambiar de pose (sentarse, bailar, pararse), se emite un evento
  puntual con el estado nuevo.
- Como red de seguridad frente a desincronización acumulada, se emite un
  **"latido" de posición a baja frecuencia** (~1–2 Hz o solo cuando hay cambio),
  que corrige la deriva sin saturar el canal.

Ventaja: el tráfico es proporcional a **acciones**, no a frames. Un jugador quieto
no emite casi nada; uno que anda emite un evento por destino más algún latido.

---

## 11. Estrategia para evitar exceso de tráfico

- **Emitir por evento, no por frame** (§10): destino, cambio de pose, cambio de
  dirección relevante, chat. Nada de un mensaje por `requestAnimationFrame`.
- **Throttle / coalescing** de los latidos de posición: como mucho ~5 Hz, y solo si
  el estado cambió respecto al último enviado (mismo espíritu que el *dirty-diff*
  previsto para el guardado en la nube).
- **Payload mínimo** (§5): sin `fase`, sin `gz`, sin campos derivables.
- **Un canal por sala**: nadie recibe eventos de salas donde no está. Las salas
  vacías no generan tráfico.
- **Aspecto/nombre resueltos con caché** (opción `uid` + `profiles`): evita reenviar
  el aspecto en cada latido.
- **Límite de aforo por sala** (a decidir): tope de avatares remotos renderizados;
  por encima, mostrar "y N más" sin pintar todos, para acotar coste de render y red.

---

## 12. Suavizado / interpolación de jugadores remotos

Los remotos **no se teletransportan** entre paquetes: se interpolan, reutilizando el
patrón ya probado con los NPCs del casino.

- Cada remoto tiene un **runtime efímero** con posición continua propia
  (`px`, `py`, `dir`, `pose`, `fase`), separada de la última posición "verdadera"
  recibida por red — igual que `rtCasino` separa `rt.px/py` de `npc.x/y`.
- En cada frame, el runtime **avanza hacia el objetivo** (destino recibido, o última
  posición conocida) a velocidad constante; si la distancia es grande (deriva o
  reaparición), se hace un *snap* suave o directo.
- La **fase de animación** de andar/bailar se genera localmente a partir de `pose`
  (no viaja por red).
- Las **burbujas de chat** se dibujan sobre la cabeza con la misma técnica que las
  frases de ambiente del casino (`rt.tVisible`, fondo semitransparente, medido con
  `ctx.measureText`).
- **Render**: cada remoto es una **caja más** en la lista de orden de pintado de
  `Sala.dibujar` (el array `cajas`), dibujada vía `Avatar.dibujar` con intercambio
  temporal de aspecto (`Avatar.ponAspecto(remoto.aspecto)` → dibujar → restaurar),
  literalmente el mismo mecanismo que `Npcs.dibujar`. Así los remotos quedan
  correctamente ordenados en profundidad con furnis, avatar local, mascotas y NPCs.

En resumen: **un jugador remoto es, para el motor, un "NPC controlado por red"**. La
plantilla de `Npcs` (runtime interpolado + `caja` + `dibujar` + burbuja) es
directamente reaprovechable.

---

## 13. Separación entre Presence, Broadcast y Base de Datos

Tres transportes con responsabilidades que **no se solapan**:

| Transporte | Qué lleva | Frecuencia | Confianza | Persiste |
|---|---|---|---|---|
| **DB (Postgres + RLS)** | decorado (`salas`), aspecto/nombre (`profiles`), progreso (`partidas`) | baja (al guardar) | **alta** (RLS) | **Sí** |
| **Presence** | roster: quién está en la sala + su último estado conocido | al entrar/salir + sync | media | No |
| **Broadcast** | eventos de alta frecuencia: movimiento, chat, emotes | por evento | **baja** (no confiar) | No |

Reglas de separación:

- La **DB es la única fuente de verdad** de todo lo persistente. El decorado que ve
  un visitante viene de la DB (SELECT), no de Presence.
- **Presence** responde "¿quién hay aquí y en qué pose?" — es el roster vivo.
- **Broadcast** responde "¿qué está pasando ahora mismo?" — movimiento y chat.
- **Un cambio de decorado del propietario mientras hay visitas** se propaga por la
  **DB** (el visitante puede re-leer `salas`), no por Broadcast. Cómo notificar ese
  cambio en vivo (por ahora: al re-entrar; en el futuro: Postgres Changes/Realtime
  sobre `salas`) se decide en una tarea posterior; **no** es objetivo de P3.
- Nada que llegue por Broadcast puede escribir en la DB. La única barrera de
  integridad real es **RLS**; el cliente nunca es de fiar.

---

## 14. Módulos futuros recomendados

Manteniendo la convención del proyecto (scripts clásicos, IIFE con API pública,
español, sin módulos ES, orden de carga explícito):

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| **`Nube` (extender)** | Capa de canal: `abrirCanalSala(salaId)`, `publicar(estado)`, `emitir(evento, datos)`, `alPresencia(cb)`, `alEvento(tipo, cb)`, `cerrarCanal()`, reconexión. Único punto que toca `cliente().channel()`. | supabase-js |
| **`Remotos`** (nuevo, `js/remotos.js`) | Runtime efímero de jugadores remotos: alta/baja desde el roster, interpolación (§12), `caja(remoto)` y `dibujar(ctx, remoto, t)` calcados de `Npcs`. Sin estado persistente. | `Avatar`, `Iso`, `Juego` |
| **`Sala` (extender)** | Pintar los remotos como cajas más en el orden de pintado; exponer el destino del avatar local para que la publicación lo emita. Sin lógica de red dentro. | `Remotos` |
| **`Directorio`/`Perfiles`** (nuevo) | Listar salas visitables (SELECT sobre `salas` públicas, agrupadas por dueño) y cachear `profiles` (aspecto/nombre) por `uid`. | `Nube` |
| **`Presencia`** (nuevo, orquestador) | Pegamento entre `Sala`/`Juego` (estado del avatar local) y `Nube` (canal): al entrar/salir de sala hace subscribe/track/untrack, aplica throttle (§11), traduce eventos de red a llamadas de `Remotos`. Análogo a lo que `Guardado` es para la persistencia. | `Nube`, `Remotos`, `Sala`, `Juego` |
| **UI de visita** (extender `UI`/`Movil`) | Entrar a la sala de otro, cartel de "estás visitando a X", ocultar decorar en modo visitante, lista de presentes. | `Directorio`, `Sala` |

Orden de carga sugerido (encaja en la cadena actual): `...avatar.js → juego.js → ...
→ remotos.js → sala.js → ...` y los servicios de nube después, con `presencia.js`
junto a `cuenta.js`. El detalle exacto se fija al implementar.

Nota importante: **la lógica de red vive en `Nube` + `Presencia`**, no dentro de
`Sala` ni de `Remotos`. `Sala` solo aprende a pintar más cajas; `Remotos` solo sabe
interpolar y dibujar. Así el motor sigue siendo probable sin red (con datos mock).

---

## 15. Riesgos técnicos

- **Seguridad / spoofing por Broadcast**: cualquiera en el canal puede emitir
  posiciones o mensajes falsos, o suplantar `uid`/`nombre`. *Mitigación*: el
  broadcast solo pinta; nunca escribe. La escritura real está protegida por RLS.
  Para el chat conviene sellar el `uid` del emisor con el de la sesión y no fiarse
  del que venga en el payload (validar contra el presence-state, que Supabase asocia
  a la conexión).
- **Coste y límites de Realtime**: mensajes/segundo y conexiones concurrentes tienen
  cuotas en el plan de Supabase. *Mitigación*: throttling agresivo (§11), un canal
  por sala, aforo máximo.
- **Sincronización de aspecto**: si un jugador cambia su aspecto mientras es visto,
  los demás no se enteran hasta que reentra. *Mitigación*: emitir un evento
  "aspecto cambiado" o releer `profiles`; de baja prioridad.
- **Colisiones y pathfinding con remotos**: hoy `rejillaBloqueo` marca como ocupadas
  las casillas de los NPCs. Si los remotos también bloquean, dos avatares podrían
  atascarse mutuamente. *Decisión recomendada*: **los remotos NO bloquean** el
  pathfinding (se atraviesan visualmente), como es tradición en este tipo de juego,
  para evitar bloqueos en salas concurridas.
- **Deriva / clock skew / orden de mensajes**: los eventos pueden llegar
  desordenados o tarde. *Mitigación*: interpolar hacia el último estado y usar
  latidos de corrección (§10); no asumir orden estricto.
- **Reconexión**: re-suscribir y re-`track` tras caídas sin duplicar avatares
  (de-dup por `uid`).
- **Cambios del decorado con visitas dentro**: el visitante ve una foto del momento
  de entrada; si el dueño redecora, no se refleja en vivo (aceptable en P3;
  Realtime sobre `salas` es trabajo posterior).
- **Sala del dueño no desbloqueada / privada**: definir qué salas son visitables
  (¿solo desbloqueadas? ¿todas las de lectura pública?). Afecta al `Directorio`.
- **`file://` vs. desplegado**: Realtime necesita WebSocket (`wss://`). En
  GitHub Pages (HTTPS) funciona; en `file://` local puede no conectar. El juego debe
  degradar a un jugador sin ruido, como ya hace `Nube` cuando no hay config.
- **Privacidad**: aunque `profiles`/`salas` son públicos por diseño, conviene que el
  usuario entienda que su sala y su avatar son visitables. Nota de producto, no
  técnica.

---

## 16. Tareas futuras (desglose P3.x)

Numeración paralela a la de la migración (T-x). Cada tarea añade su modo de prueba
`<algo>_flujo` y/o sus escenas de captura en `index.html`, como exige el proyecto, y
mantiene el principio defensivo (sin red → juego de un jugador intacto).

- **P3.1 — Diseño (este documento).** Sin código.
- **P3.2 — Capa de canal en `Nube`.** Añadir a `js/services/supabase.js` la API de
  canal (`abrirCanalSala`, `publicar`/`track`, `emitir`/`broadcast`, `alPresencia`,
  `alEvento`, `cerrarCanal`, reconexión), envuelta de forma defensiva. Sin cablear a
  la UI ni al juego; probada de forma aislada con cliente/sesión mockeados (igual que
  se probó `AlmacenNube` en T5.2). **Aún sin SQL nuevo.**
- **P3.3 — Módulo `Remotos` (render, sin red).** Runtime + interpolación + `caja` +
  `dibujar`, alimentado por **datos mock locales** (nada de WebSocket todavía).
  `Sala` aprende a pintar remotos como cajas más. Modo de prueba `remotos_flujo` y
  escena de captura `remotos` que inyectan avatares falsos y verifican orden de
  pintado, interpolación y burbujas. Es el paso donde se ve el multijugador
  "de mentira" antes de enchufar la red.
- **P3.4 — Publicar el estado del jugador local.** Orquestador `Presencia`:
  subscribe/track al entrar en la propia sala, untrack/unsubscribe al salir, emisión
  por destino + latido con throttle (§10, §11). Todavía solo en la sala propia
  (todos los clientes del mismo usuario se verían; útil para probar con dos pestañas).
- **P3.5 — Recibir remotos reales.** Conectar el roster/eventos de `Nube` a
  `Remotos`: ver de verdad a otros avatares moverse en tiempo real. De-dup por `uid`,
  timeout de fantasmas, límite de aforo.
- **P3.6 — Chat remoto por Broadcast.** Reutilizar el chat existente para emitir y
  recibir mensajes; burbujas sobre los remotos (patrón del casino). Sellar el `uid`
  del emisor contra la sesión.
- **P3.7 — Visitar salas de otros.** `Directorio` (listar salas visitables desde
  `salas` públicas) + entrada en sala ajena: cargar el decorado por SELECT, forzar
  modo pasear, ocultar decorar, cartel de "visitando a X". Modo de prueba
  `visita_flujo`.
- **P3.8 — Poses sincronizadas (sentarse / bailar / emotes).** Propagar `pose` y
  `gz` derivado; que un visitante se siente en un mueble del dueño y los demás lo
  vean sentado; bailar sincronizado.
- **P3.9 — Pulido y robustez.** Reconexión fina, aforo, degradación, seguridad,
  rendimiento con muchos avatares, y **si hiciera falta** ajustes de SQL/Realtime
  (habilitar Realtime en tablas, políticas de canal). Cualquier cambio de esquema se
  documenta en `supabase/` con su propio archivo, como `T1_esquema.sql`.

---

## Apéndice — Anclajes en el código actual (para el implementador)

- **Avatar local**: objeto `avatar` en `js/sala.js` (`{x, y, dir, pose, fase, gz,
  sentadoEn, casilla}`). Su movimiento está en `Sala.actualizar`.
- **Plantilla de "avatar controlado por lógica"**: `Npcs` (`js/npcs.js`), en
  especial los NPCs de casino: `runtimeCasino`, `tickCasino` (interpolación),
  `caja`, `dibujar` (intercambio de aspecto + burbuja + nombre flotante).
- **Orden de pintado**: array `cajas` en `Sala.dibujar` + `Iso.ordenarCajas`. Ahí se
  insertan los remotos.
- **Aspecto del avatar**: `Avatar.ponAspecto` / `Juego.aspecto()` /
  `profiles.avatar`. Ya es público.
- **Identidad de sala y frontera público/privado**: `supabase/T1_esquema.sql`
  (tablas `profiles`/`salas`/`partidas`, RLS, `unique (user_id, indice)`).
- **Traducción fila↔sala reutilizable**: `AlmacenNube.filaASala` /
  `salaAFila` en `js/services/almacen-nube.js`.
- **Único punto de acceso a Supabase**: `Nube` (`js/services/supabase.js`).
- **Persistencia (NO tocar en P3)**: `Guardado` + `AlmacenLocal`/`AlmacenNube`
  (`js/guardado.js`, `js/services/almacen-nube.js`).
