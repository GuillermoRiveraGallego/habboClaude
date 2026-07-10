"use strict";

// ============================================================
// PRESENCIA — orquestador de Presence local (Fase Presence, P3.4).
//
// ÚNICO orquestador que conecta las tres piezas:
//   - estado del jugador local  (Sala.estadoAvatar / Juego.aspecto)
//   - canal Realtime             (Nube.abrirCanalSala/suscribir/track/…)
//   - actores remotos            (Remotos.alta/actualizar/baja/limpiar)
//
// NO contiene lógica de guardado (no toca Guardado/AlmacenLocal/
// AlmacenNube) y NO llama a Supabase fuera de `Nube`.
//
// Alcance de P3.4: dentro de una misma sala PROPIA, dos pestañas de
// la misma cuenta se ven como jugadores remotos. Todavía NO hay
// visitas a salas ajenas, ni chat, ni amigos/salas públicas.
//
// Transporte (afinado en P3.5 tras validar contra Realtime real):
//   - PRESENCE = roster. Se hace `track` UNA sola vez al entrar (con
//     identidad + posición inicial) y `untrack` al salir. Así cada
//     cliente tiene UNA meta y las altas/bajas (join/leave) son
//     fiables. (Hacer `track` en cada movimiento acumulaba metas que
//     `untrack` no limpiaba, y los remotos no desaparecían al salir.)
//   - BROADCAST = movimiento. La posición/dirección/pose viaja por
//     `emitir`/`alBroadcast` (evento "mov"), que es efímero y no
//     ensucia el roster (docs/presence-arquitectura.md §12/§13).
//   - Al detectar un recién llegado (join) se reemite la posición
//     actual, para que vea a los que ya estaban quietos.
//
// Identidad:
//   - salaId  = "<userId>:<indiceSala>"  (dueño + índice; la sala es
//               propia en P3.4, así que el dueño soy yo).
//   - clientId = id único POR PESTAÑA. La clave de presence del canal
//               es el clientId, de modo que dos pestañas con el MISMO
//               userId pero distinto clientId aparecen por separado.
//               Para no pintarme a mí mismo se ignora SOLO mi clientId
//               (no el userId).
//
// Degradación defensiva: sin Nube lista, sin sesión, canal no
// disponible o suscripción fallida, `entrar()` no hace nada (resuelve
// false) y no deja ruido. El juego sigue igual, en un jugador.
// ============================================================
var Presencia = (function () {

  var PUBLICAR_MS = 200;    // cadencia del bucle de publicación (≤5/seg)
  var HEARTBEAT_MS = 5000;  // quieto: re-publica al menos cada 5 s
  var MAX_CHAT = 120;       // longitud máxima de un mensaje de chat

  // id único por pestaña (distingue dos tabs de la misma cuenta)
  var clientId = "c-" + Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2, 8);

  var canal = null;         // envoltorio de canal de Nube (o null)
  var activo = false;       // hay canal suscrito y publicando
  var userId = null;
  var nombre = "Jugador";
  var salaId = null;
  var ultimo = null;        // última foto publicada {cx,cy,dir,pose,t}
  var bucleId = null;
  var generacion = 0;       // token para descartar async obsoleto
  var yaIniciado = false;

  // ---------------- estado local publicado ----------------

  function construirEstado(e) {
    return {
      userId: userId,
      clientId: clientId,
      nombre: nombre,
      aspecto: (window.Juego && Juego.aspecto) ? Juego.aspecto() : {},
      salaId: salaId,
      x: e.x, y: e.y, dir: e.dir, pose: e.pose,
      updatedAt: Date.now()
    };
  }

  // Emite el movimiento por BROADCAST solo si cambió la casilla, la
  // dirección o la pose, o si toca heartbeat. Fire-and-forget: `emitir`
  // de Nube nunca lanza. NO usa `track` (eso solo se hace al entrar).
  function emitirMovimiento(forzar) {
    if (!activo || !canal || !window.Sala) return;
    var e = Sala.estadoAvatar();
    var cx = Math.floor(e.x), cy = Math.floor(e.y);
    var ahora = Date.now();
    var cambio = !ultimo || ultimo.cx !== cx || ultimo.cy !== cy ||
      ultimo.dir !== e.dir || ultimo.pose !== e.pose;
    var heartbeat = !ultimo || (ahora - ultimo.t) > HEARTBEAT_MS;
    if (!forzar && !cambio && !heartbeat) return;
    ultimo = { cx: cx, cy: cy, dir: e.dir, pose: e.pose, t: ahora };
    Nube.emitir(canal, "mov", {
      clientId: clientId, x: e.x, y: e.y, dir: e.dir, pose: e.pose
    });
  }

  // Recibe el movimiento de otra pestaña/jugador y actualiza su actor.
  // Si aún no existe (el alta la hace la presencia), se ignora.
  function alMovimiento(payload) {
    if (!payload || !payload.clientId || payload.clientId === clientId) return;
    if (!window.Remotos || !Remotos.obtener(payload.clientId)) return;
    Remotos.actualizar(payload.clientId, {
      x: payload.x, y: payload.y, dir: payload.dir, pose: payload.pose
    });
  }

  // Alguien acaba de entrar: reconstruye el roster y reemite mi
  // posición actual, para que el recién llegado me vea donde estoy
  // (no en la posición inicial del track).
  function alEntrarOtro() {
    reconciliar();
    emitirMovimiento(true);
  }

  // ---------------- chat (Broadcast "chat", P3.6) ----------------

  // Texto SIEMPRE tratado como plano: normaliza saltos/tabs, recorta
  // extremos y limita a MAX_CHAT. El render es por fillText en canvas
  // (burbujas de Sala/Remotos), así que no se interpreta HTML.
  function limpiarTexto(t) {
    if (typeof t !== "string") return "";
    return t.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_CHAT);
  }

  // Envía un mensaje del jugador local: muestra su burbuja YA (no por
  // el broadcast, para no duplicar) y lo emite por Broadcast "chat".
  // Si no hay canal/sesión, la burbuja local sigue funcionando.
  // Devuelve true si el texto era válido.
  function enviarChat(texto) {
    var limpio = limpiarTexto(texto);
    if (!limpio) return false;
    if (window.Sala && Sala.decir) Sala.decir(limpio);   // burbuja local inmediata
    if (activo && canal) {
      Nube.emitir(canal, "chat", {
        clientId: clientId, userId: userId, salaId: salaId,
        texto: limpio, ts: Date.now()
      });
    }
    return true;
  }

  // Recibe un mensaje remoto. Confianza cero: valida canal, sala,
  // clientId (existente, no propio) y texto; ignora nombre/avatar u
  // otros campos del payload. El actor válido es el clientId que YA
  // existe en Remotos (no se crea desde el chat).
  function alChat(payload) {
    if (!activo || !canal || !window.Remotos) return;
    if (!payload || typeof payload !== "object") return;
    if (payload.salaId !== salaId) return;               // otra sala
    var cid = payload.clientId;
    if (!cid || cid === clientId) return;                // sin clientId o propio
    if (!Remotos.obtener(cid)) return;                   // no hay actor remoto
    var limpio = limpiarTexto(payload.texto);
    if (!limpio) return;                                 // vacío / no string
    Remotos.decir(cid, limpio);
  }

  function arrancarBucle() {
    pararBucle();
    bucleId = setInterval(function () { emitirMovimiento(false); }, PUBLICAR_MS);
  }

  function pararBucle() {
    if (bucleId) { clearInterval(bucleId); bucleId = null; }
  }

  // ---------------- roster remoto ----------------

  // Reconstruye los actores remotos a partir del roster de presence.
  // Se usa como manejador de sync/join/leave. Ignora SIEMPRE mi propio
  // clientId (nunca me pinto). Da de baja a quien ya no esté.
  function reconciliar() {
    if (!canal || !window.Remotos) return;
    var roster = Nube.presentes(canal) || {};
    var vistos = {};
    Object.keys(roster).forEach(function (k) {
      // Un cliente puede tener VARIAS metas en el roster (el track de
      // presence conserva estados anteriores un instante); nos quedamos
      // con la MÁS RECIENTE por updatedAt para no pintar una posición
      // obsoleta. (El movimiento fino se moverá a Broadcast en P3.6.)
      var metas = roster[k] || [];
      var m = null;
      for (var i = 0; i < metas.length; i++) {
        var c = metas[i];
        if (!c || !c.clientId || c.clientId === clientId) continue;
        if (!m || (c.updatedAt || 0) >= (m.updatedAt || 0)) m = c;
      }
      if (!m) return;
      vistos[m.clientId] = true;
      var datos = {
        id: m.clientId, nombre: m.nombre, aspecto: m.aspecto,
        x: m.x, y: m.y, dir: m.dir, pose: m.pose
      };
      if (Remotos.obtener(m.clientId)) Remotos.actualizar(m.clientId, datos);
      else Remotos.alta(datos);
    });
    Remotos.lista().forEach(function (a) {
      if (!vistos[a.id]) Remotos.baja(a.id);
    });
  }

  // ---------------- entrar / salir ----------------

  // Abre Presence para la sala PROPIA actual. Resuelve true si quedó
  // conectado, false si degradó (sin sesión/Realtime/etc.).
  function entrar() {
    if (!window.Nube || !Nube.disponible() || !window.Remotos || !window.Sala) {
      return Promise.resolve(false);
    }
    var gen = ++generacion;
    return Nube.usuario().then(function (u) {
      if (gen !== generacion) return false;      // se cambió de sala entretanto
      if (!u || !u.id) return false;             // sin sesión: no-op silencioso
      userId = u.id;
      nombre = u.email ? u.email.split("@")[0] : "Jugador";
      // el canal es el de la sala CARGADA: si visito, el del DUEÑO
      // (ownerUserId:indice); si no, el mío. `userId` sigue siendo mi
      // identidad en la meta de presence (P3.7).
      var obj = (window.Visita && Visita.objetivo) ? Visita.objetivo() : null;
      salaId = obj ? (obj.ownerUserId + ":" + obj.indice) : (userId + ":" + Juego.indiceSala());

      canal = Nube.abrirCanalSala(salaId, { clave: clientId });
      if (!canal || !canal.disponible) { canal = null; return false; }

      // Presence = altas/bajas; Broadcast "mov" = movimiento, "chat" = chat.
      Nube.alPresencia(canal, { sync: reconciliar, join: alEntrarOtro, leave: reconciliar });
      Nube.alBroadcast(canal, "mov", alMovimiento);
      Nube.alBroadcast(canal, "chat", alChat);

      return Nube.suscribir(canal).then(function (estadoCanal) {
        if (gen !== generacion) { Nube.cerrarCanal(canal); canal = null; return false; }
        if (estadoCanal !== "SUBSCRIBED") { Nube.cerrarCanal(canal); canal = null; return false; }
        activo = true;
        ultimo = null;
        // track UNA sola vez (identidad + posición inicial); el
        // movimiento posterior va por Broadcast, no por track.
        return Nube.track(canal, construirEstado(Sala.estadoAvatar())).then(function () {
          if (gen !== generacion) return false;
          reconciliar();       // por si ya había gente al entrar
          arrancarBucle();
          return true;
        });
      });
    }).catch(function (e) {
      console.warn("Presencia: no se pudo entrar", e && e.message);
      activo = false;
      return false;
    });
  }

  // Cierra Presence de la sala actual y limpia los remotos. Seguro de
  // llamar aunque no haya nada abierto.
  function salir() {
    generacion++;               // invalida cualquier entrar() en curso
    pararBucle();
    var c = canal;
    activo = false;
    canal = null;
    ultimo = null;
    if (window.Remotos) Remotos.limpiar();
    if (!c) return Promise.resolve(true);
    return Nube.untrack(c)
      .then(function () { return Nube.cerrarCanal(c); })
      .then(function () { return true; })
      .catch(function () { return true; });
  }

  // Cambio de sala: salir de la anterior y entrar en la actual.
  function alCargarSala() {
    salir().then(entrar);
  }

  // ---------------- ciclo de vida ----------------

  // Se llama una vez en el arranque (fuera de pruebas y solo si Nube
  // está lista). Engancha el aviso de carga de sala y entra en la
  // sala inicial. Idempotente.
  function iniciar() {
    if (yaIniciado) return;
    yaIniciado = true;
    if (window.Sala && Sala.alCargar) Sala.alCargar(alCargarSala);
    entrar();
  }

  return {
    iniciar: iniciar,
    entrar: entrar,
    salir: salir,
    enviarChat: enviarChat,
    activo: function () { return activo; },
    clientId: function () { return clientId; },
    // instantánea para depurar/probar
    estado: function () {
      return { clientId: clientId, salaId: salaId, activo: activo, userId: userId };
    }
  };
})();
