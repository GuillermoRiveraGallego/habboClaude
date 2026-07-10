"use strict";

// ============================================================
// NUBE — único punto de acceso a Supabase de todo el proyecto.
//
// Ningún otro módulo debe llamar a `window.supabase` ni a
// `createClient` directamente: todo pasa por aquí.
//
// De momento (T2) esto SOLO prepara la infraestructura: lee la
// configuración de `window.SUPABASE_CONFIG` (config.js), crea el
// cliente y deja saber si Supabase está disponible. Todavía no
// hay login, ni guardado/carga, ni sincronización, ni Realtime.
//
// Diseño defensivo: si no hay config.js, faltan las claves o no
// se cargó la librería, el juego sigue funcionando igual y
// Supabase queda simplemente deshabilitado (sin lanzar errores).
//
// Estados posibles (Nube.estado().estado):
//   "sin_iniciar"    - aún no se llamó a inicializar()
//   "sin_configurar" - falta config.js o las claves
//   "sin_libreria"   - no se cargó js/vendor/supabase.js
//   "error"          - createClient falló
//   "listo"          - cliente creado y disponible
// ============================================================
var Nube = (function () {

  var cliente = null;
  var estado = "sin_iniciar";
  var motivo = "";

  function config() {
    return (typeof window !== "undefined" && window.SUPABASE_CONFIG) || null;
  }

  function clave(cfg) {
    // aceptamos ambos nombres por comodidad; el término oficial
    // actual de Supabase es "publishable key"
    return cfg.publishableKey || cfg.anonKey || "";
  }

  // Crea el cliente si se puede. Idempotente: si ya está listo,
  // no vuelve a crearlo. Nunca lanza; devuelve true/false.
  function inicializar() {
    if (estado === "listo") return true;

    var cfg = config();
    if (!cfg || !cfg.url || !clave(cfg)) {
      estado = "sin_configurar";
      motivo = "Falta config.js o las claves de Supabase; se juega solo en local.";
      return false;
    }

    if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
      estado = "sin_libreria";
      motivo = "No se cargó supabase-js (js/vendor/supabase.js).";
      return false;
    }

    try {
      cliente = window.supabase.createClient(cfg.url, clave(cfg), {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      estado = "listo";
      motivo = "";
      return true;
    } catch (e) {
      cliente = null;
      estado = "error";
      motivo = (e && e.message) || String(e);
      return false;
    }
  }

  function disponible() {
    return estado === "listo" && !!cliente;
  }

  function obtenerCliente() {
    return cliente;
  }

  function estadoActual() {
    return { estado: estado, motivo: motivo };
  }

  // ---------------- autenticación (T4) ----------------
  // Envoltura defensiva de supabase.auth. NO toca la base de
  // datos ni guarda/carga partidas: solo gestiona la sesión.
  // Todas las funciones son asíncronas y devuelven el formato
  // de Supabase { data, error }; si Supabase no está disponible,
  // devuelven un error controlado en vez de romper.

  function errorSinNube() {
    return { data: null, error: { message: "Supabase no está disponible; se juega en local." } };
  }

  // Registro con email + contraseña (confirmación de email
  // desactivada en desarrollo → deja sesión iniciada).
  function registrar(email, contrasena) {
    if (!disponible()) return Promise.resolve(errorSinNube());
    return cliente.auth.signUp({ email: email, password: contrasena });
  }

  // Inicio de sesión con email + contraseña.
  function entrar(email, contrasena) {
    if (!disponible()) return Promise.resolve(errorSinNube());
    return cliente.auth.signInWithPassword({ email: email, password: contrasena });
  }

  // Cierre de sesión.
  function salir() {
    if (!disponible()) return Promise.resolve({ error: null });
    return cliente.auth.signOut();
  }

  // Usuario actual (o null). Lee la sesión persistida localmente
  // por supabase-js; es asíncrono.
  function usuario() {
    if (!disponible()) return Promise.resolve(null);
    return cliente.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session) ? r.data.session.user : null;
    });
  }

  // Suscribe un callback a los cambios de sesión (login/logout y
  // la sesión inicial al cargar). cb recibe (sesion|null, evento).
  // Devuelve una función para desuscribirse (no-op si no hay nube).
  function alCambiarSesion(cb) {
    if (!disponible()) return function () {};
    var r = cliente.auth.onAuthStateChange(function (evento, sesion) {
      cb(sesion || null, evento);
    });
    return function () {
      try { r.data.subscription.unsubscribe(); } catch (e) {}
    };
  }

  // ---------------- lecturas públicas de salas (P3.7) ----------------
  // Solo LECTURA de la tabla `salas` (RLS: select público). Sirven
  // para visitar salas ajenas; no escriben nada. Defensivas: sin nube
  // devuelven null / [] sin lanzar. NO tocan AlmacenNube ni el guardado.

  // Lee una sala concreta de cualquier usuario por (user_id, indice).
  function leerSala(ownerUserId, indice) {
    if (!disponible() || !ownerUserId) return Promise.resolve(null);
    return cliente.from("salas").select("*")
      .eq("user_id", ownerUserId).eq("indice", indice).maybeSingle()
      .then(function (r) { if (r.error) throw r.error; return r.data || null; })
      .catch(function (e) { console.warn("Nube.leerSala:", e && e.message); return null; });
  }

  // Lista salas visitables (metadatos ligeros). `limite` opcional.
  // Devuelve [] ante cualquier problema.
  function listarSalas(limite) {
    if (!disponible()) return Promise.resolve([]);
    var q = cliente.from("salas")
      .select("user_id, indice, nombre, tipo, desbloqueada")
      .order("user_id", { ascending: true }).order("indice", { ascending: true });
    if (limite) q = q.limit(limite);
    return q.then(function (r) { if (r.error) throw r.error; return r.data || []; })
      .catch(function (e) { console.warn("Nube.listarSalas:", e && e.message); return []; });
  }

  // ---------------- Realtime: canales (P3.2) ----------------
  // Capa BASE de canales, único punto que toca supabase Realtime
  // (nadie fuera de aquí debe llamar a cliente().channel()). Es
  // infraestructura: NO conecta Presence al juego ni pinta remotos;
  // solo deja listas las primitivas para P3.3+.
  //
  // Diseño defensivo, igual que el resto de Nube: si no hay config,
  // no hay sesión o Realtime no está disponible, `abrirCanalSala`
  // devuelve un CANAL NULO (inerte) y todas las operaciones sobre él
  // son no-ops seguras. El juego nunca recibe una excepción por esto,
  // así que quien llame no necesita comprobar nulos.
  //
  // Un "canal" aquí es un envoltorio: { salaId, nombre, bruto,
  // disponible, suscrito, motivo }. `bruto` es el RealtimeChannel de
  // supabase (o null en el canal nulo).
  //
  // Flujo previsto (lo compone P3.4, no esta tarea):
  //   var c = Nube.abrirCanalSala(salaId);
  //   Nube.alPresencia(c, { sync, join, leave });   // ANTES de suscribir
  //   Nube.alBroadcast(c, "mover", fn);             // ANTES de suscribir
  //   Nube.suscribir(c).then(function () { Nube.track(c, estado); });
  //   ... Nube.emitir(c, "mover", payload) ...
  //   Nube.untrack(c); Nube.cerrarCanal(c);

  function canalNulo(salaId, motivoNulo) {
    return {
      salaId: salaId || null, nombre: null, bruto: null,
      disponible: false, suscrito: false, motivo: motivoNulo || ""
    };
  }

  function canalUtil(canal) {
    return !!(canal && canal.disponible && canal.bruto);
  }

  function resultado(promesa) {
    // Normaliza cualquier resultado (o promesa) del SDK a
    // { ok, ... } y captura fallos para no propagarlos al juego.
    return Promise.resolve(promesa).then(
      function (r) { return { ok: true, resultado: r }; },
      function (e) { return { ok: false, motivo: (e && e.message) || String(e) }; }
    );
  }

  // Abre (sin suscribir) el canal de una sala: presence:sala:<salaId>.
  // opciones.recibirPropios (bool) = recibir también los broadcast
  // que emite este mismo cliente (útil para pruebas con una pestaña).
  // opciones.clave = clave de presence (por defecto la asigna el SDK).
  function abrirCanalSala(salaId, opciones) {
    opciones = opciones || {};
    if (!salaId) return canalNulo(salaId, "salaId vacío");
    if (!disponible()) return canalNulo(salaId, "Supabase no disponible");
    if (!cliente || typeof cliente.channel !== "function") {
      return canalNulo(salaId, "Realtime no disponible en esta librería");
    }
    try {
      var nombre = "presence:sala:" + salaId;
      var cfg = { broadcast: { self: !!opciones.recibirPropios } };
      if (opciones.clave) cfg.presence = { key: opciones.clave };
      var bruto = cliente.channel(nombre, { config: cfg });
      return {
        salaId: salaId, nombre: nombre, bruto: bruto,
        disponible: true, suscrito: false, motivo: ""
      };
    } catch (e) {
      console.warn("Nube: no se pudo abrir el canal de sala", e && e.message);
      return canalNulo(salaId, (e && e.message) || String(e));
    }
  }

  // Registra manejadores de PRESENCE. handlers = { sync, join, leave }.
  // sync recibe el estado de presencia completo; join/leave el payload
  // del SDK ({ key, newPresences } / { key, leftPresences }).
  // DEBE llamarse ANTES de suscribir. Devuelve el canal (encadenable).
  function alPresencia(canal, handlers) {
    if (!canalUtil(canal)) return canal;
    handlers = handlers || {};
    try {
      var ch = canal.bruto;
      if (handlers.sync) {
        ch.on("presence", { event: "sync" }, function () {
          handlers.sync(presentes(canal));
        });
      }
      if (handlers.join) {
        ch.on("presence", { event: "join" }, function (p) { handlers.join(p); });
      }
      if (handlers.leave) {
        ch.on("presence", { event: "leave" }, function (p) { handlers.leave(p); });
      }
    } catch (e) {
      console.warn("Nube: alPresencia falló", e && e.message);
    }
    return canal;
  }

  // Registra un manejador de BROADCAST para un evento concreto.
  // handler recibe (payload, mensajeCompleto). DEBE llamarse ANTES de
  // suscribir. Devuelve el canal (encadenable).
  function alBroadcast(canal, evento, handler) {
    if (!canalUtil(canal) || !handler) return canal;
    try {
      canal.bruto.on("broadcast", { event: evento }, function (msg) {
        handler(msg && msg.payload, msg);
      });
    } catch (e) {
      console.warn("Nube: alBroadcast falló", e && e.message);
    }
    return canal;
  }

  // Suscribe el canal. alEstado(estadoCanal) (opcional) recibe cada
  // cambio de estado del SDK. Devuelve una Promesa que resuelve con el
  // estado terminal ("SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" |
  // "CLOSED" | "nulo" | "error"). Nunca rechaza.
  function suscribir(canal, alEstado) {
    if (!canalUtil(canal)) {
      if (alEstado) { try { alEstado("nulo"); } catch (e) {} }
      return Promise.resolve("nulo");
    }
    return new Promise(function (resolve) {
      var resuelto = false;
      function fin(estadoCanal) {
        if (resuelto) return;
        resuelto = true;
        canal.suscrito = (estadoCanal === "SUBSCRIBED");
        resolve(estadoCanal);
      }
      try {
        canal.bruto.subscribe(function (estadoCanal) {
          if (alEstado) { try { alEstado(estadoCanal); } catch (e) {} }
          if (estadoCanal === "SUBSCRIBED" || estadoCanal === "CHANNEL_ERROR" ||
              estadoCanal === "TIMED_OUT" || estadoCanal === "CLOSED") {
            fin(estadoCanal);
          }
        });
      } catch (e) {
        console.warn("Nube: suscribir falló", e && e.message);
        fin("error");
      }
    });
  }

  // Publica el estado de presencia de este cliente en el canal
  // (aparece en el roster de los demás). Devuelve Promesa { ok, ... }.
  function track(canal, estado) {
    if (!canalUtil(canal) || !canal.bruto.track) {
      return Promise.resolve({ ok: false, motivo: "canal no disponible" });
    }
    try {
      return resultado(canal.bruto.track(estado || {}));
    } catch (e) {
      return Promise.resolve({ ok: false, motivo: (e && e.message) || String(e) });
    }
  }

  // Retira el estado de presencia de este cliente. Promesa { ok, ... }.
  function untrack(canal) {
    if (!canalUtil(canal) || !canal.bruto.untrack) {
      return Promise.resolve({ ok: false, motivo: "canal no disponible" });
    }
    try {
      return resultado(canal.bruto.untrack());
    } catch (e) {
      return Promise.resolve({ ok: false, motivo: (e && e.message) || String(e) });
    }
  }

  // Emite un evento de BROADCAST (efímero, no confiable). Promesa
  // { ok, ... }. El payload solo debe llevar datos "de pintar" (ver
  // docs/presence-arquitectura.md §6): nunca créditos ni progreso.
  function emitir(canal, evento, payload) {
    if (!canalUtil(canal) || !canal.bruto.send) {
      return Promise.resolve({ ok: false, motivo: "canal no disponible" });
    }
    try {
      return resultado(canal.bruto.send({
        type: "broadcast", event: evento, payload: payload || {}
      }));
    } catch (e) {
      return Promise.resolve({ ok: false, motivo: (e && e.message) || String(e) });
    }
  }

  // Lee el estado de presencia actual del canal (roster). Devuelve un
  // objeto (posiblemente vacío); nunca lanza.
  function presentes(canal) {
    if (!canalUtil(canal) || !canal.bruto.presenceState) return {};
    try { return canal.bruto.presenceState() || {}; }
    catch (e) { return {}; }
  }

  // Cierra y elimina el canal. Idempotente y seguro sobre canal nulo.
  // Promesa { ok, ... }.
  function cerrarCanal(canal) {
    if (!canal || !canal.bruto) return Promise.resolve({ ok: true });
    try {
      canal.disponible = false;
      canal.suscrito = false;
      if (cliente && cliente.removeChannel) {
        return resultado(cliente.removeChannel(canal.bruto));
      }
      if (canal.bruto.unsubscribe) {
        return resultado(canal.bruto.unsubscribe());
      }
    } catch (e) {
      console.warn("Nube: cerrarCanal falló", e && e.message);
    }
    return Promise.resolve({ ok: true });
  }

  // Punto de inyección para pruebas aisladas (index.html?prueba=
  // presence_flujo): enchufa un cliente falso con .channel() para
  // ejercitar la capa de canales sin red. Fuera de pruebas no se usa.
  var depurar = {
    inyectarCliente: function (fake) {
      cliente = fake || null;
      estado = fake ? "listo" : "sin_iniciar";
      motivo = "";
    }
  };

  return {
    inicializar: inicializar,
    disponible: disponible,
    cliente: obtenerCliente,
    estado: estadoActual,
    registrar: registrar,
    entrar: entrar,
    salir: salir,
    usuario: usuario,
    alCambiarSesion: alCambiarSesion,
    // ---- lecturas públicas de salas (P3.7) ----
    leerSala: leerSala,
    listarSalas: listarSalas,
    // ---- Realtime: canales (P3.2) ----
    abrirCanalSala: abrirCanalSala,
    suscribir: suscribir,
    alPresencia: alPresencia,
    alBroadcast: alBroadcast,
    track: track,
    untrack: untrack,
    emitir: emitir,
    presentes: presentes,
    cerrarCanal: cerrarCanal,
    depurar: depurar
  };
})();
