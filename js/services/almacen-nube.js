"use strict";

// ============================================================
// ALMACÉN NUBE — backend de persistencia en Supabase.
//
// Traduce entre el BLOB único que usa el juego (Juego.estado(),
// que espera Juego.iniciar()/migrar()) y las TRES tablas de la
// base de datos:
//   - partidas.estado_privado  (privado: créditos, inventario, …)
//   - profiles.avatar          (público: aspecto del avatar)
//   - salas                    (una fila por sala, con sus furnis)
//
// T5.1: funciones PURAS de traducción (desglosar/reensamblar).
// T5.2: contrato de backend real contra Supabase (cargar/guardar/
//   reiniciar) usando esas funciones y el cliente de `Nube`. Sigue
//   SIN cablearse al arranque ni a `Guardado`; solo se prueba de
//   forma aislada (sonda con cliente/ sesión mockeados). Sin sesión,
//   las operaciones fallan de forma controlada y no escriben nada.
// T5.3: `cargarOSembrar()` — si la cuenta logueada aún no tiene
//   salas, siembra una partida nueva (Juego.nuevaPartida()) y la
//   guarda. No lee ni importa de localStorage; sin modal.
// T5.4: concurrencia optimista con `updated_at`. cargar() guarda
//   los tokens updated_at (partidas, profiles y cada sala) y
//   guardar() escribe condicionado a esos tokens; si una escritura
//   afecta 0 filas es CONFLICTO: no pisa, rechaza y deja el estado
//   `pendiente` para que la UI avise. Recuperación = volver a cargar.
//
// Reparto:
//   estado.salas   <-> filas de la tabla `salas` (camelCase <-> snake_case,
//                      con `indice` para conservar el orden)
//   estado.avatar  <-> profiles.avatar
//   estado.version <-> partidas.version (columna aparte)
//   el resto       <-> partidas.estado_privado (genérico: cualquier
//                      campo privado nuevo se conserva sin tocar esto)
// ============================================================
var AlmacenNube = (function () {

  // Claves del estado que NO viven en partidas.estado_privado:
  // salas -> tabla salas, avatar -> profiles, version -> columna.
  var FUERA_DE_PRIVADO = { salas: true, avatar: true, version: true };

  // Concurrencia optimista (T5.4): tokens updated_at de lo último
  // cargado, y el estado que quedó sin guardar por un conflicto.
  var tokens = { partida: null, profile: null, salas: {} };
  var pendiente = null;

  // ---- sala (juego) -> fila (tabla salas) ----
  function salaAFila(sala, indice) {
    return {
      indice: indice,
      nombre: sala.nombre,
      ancho: sala.ancho,
      fondo: sala.fondo,
      tipo: (sala.tipo !== undefined ? sala.tipo : null),
      color_suelo: sala.colorSuelo,
      color_pared: sala.colorPared,
      desbloqueada: !!sala.desbloqueada,
      precio: sala.precio,
      furnis: sala.furnis || []
    };
  }

  // ---- fila (tabla salas) -> sala (juego) ----
  function filaASala(fila) {
    var sala = {
      nombre: fila.nombre,
      ancho: fila.ancho,
      fondo: fila.fondo,
      colorSuelo: fila.color_suelo,
      colorPared: fila.color_pared,
      desbloqueada: !!fila.desbloqueada,
      precio: fila.precio,
      furnis: fila.furnis || []
    };
    // `tipo` solo existe en salas especiales (jardín/baile/casino);
    // las normales no llevan la clave (para round-trip limpio).
    if (fila.tipo) sala.tipo = fila.tipo;
    return sala;
  }

  // ============================================================
  // desglosarEstadoNube(estado)
  //   Parte el blob del juego en las piezas que van a cada tabla.
  //   Devuelve { partida, profile, salas } listo para escribir:
  //     partida = { version, estado_privado }   (fila de `partidas`)
  //     profile = { avatar }                     (campos de `profiles`)
  //     salas   = [ fila, … ]                    (filas de `salas`)
  // ============================================================
  function desglosarEstadoNube(estado) {
    estado = estado || {};

    var privado = {};
    Object.keys(estado).forEach(function (k) {
      if (!FUERA_DE_PRIVADO[k]) privado[k] = estado[k];
    });

    var salas = (estado.salas || []).map(function (sala, i) {
      return salaAFila(sala, i);
    });

    return {
      partida: { version: estado.version, estado_privado: privado },
      profile: { avatar: estado.avatar },
      salas: salas
    };
  }

  // ============================================================
  // reensamblarEstadoNube(partida, profile, salasRows)
  //   Reconstruye el blob del juego a partir de las filas leídas
  //   de las tres tablas. El resultado se pasa por Juego.migrar()
  //   igual que una partida de localStorage, así que basta con
  //   colocar cada valor en su sitio (migrar rellena lo que falte).
  //     partida   = fila de `partidas` ({ version, estado_privado })
  //     profile   = fila de `profiles` ({ avatar, … })
  //     salasRows = filas de `salas` (en cualquier orden)
  // ============================================================
  function reensamblarEstadoNube(partida, profile, salasRows) {
    partida = partida || {};
    var privado = partida.estado_privado || {};

    // parte del blob privado (conserva cualquier campo, presente o futuro)
    var estado = {};
    Object.keys(privado).forEach(function (k) { estado[k] = privado[k]; });

    estado.version = partida.version;
    estado.avatar = profile ? profile.avatar : undefined;

    var filas = (salasRows || []).slice().sort(function (a, b) {
      return (a.indice || 0) - (b.indice || 0);
    });
    estado.salas = filas.map(filaASala);

    return estado;
  }

  // ============================================================
  // Contrato de backend (T5.2) — contra Supabase vía `Nube`.
  // cargar()/guardar() son asíncronos (Promesa). Sin sesión
  // rechazan de forma controlada, sin escribir nada.
  // ============================================================

  // uid de la sesión actual, o null si no hay sesión / sin nube.
  function sesionUid() {
    if (!window.Nube || !Nube.disponible()) return Promise.resolve(null);
    return Nube.usuario().then(function (u) { return u ? u.id : null; });
  }

  function cliente() {
    var cli = window.Nube && Nube.cliente();
    if (!cli) throw new Error("AlmacenNube: no hay cliente de Supabase");
    return cli;
  }

  // Lee las 3 tablas y recompone el estado. Devuelve null si la
  // cuenta aún no tiene salas (partida vacía en la nube) — el
  // sembrado/import de esa situación es cosa de T5.3.
  function cargar() {
    return sesionUid().then(function (uid) {
      if (!uid) throw new Error("AlmacenNube.cargar: no hay sesión");
      var cli = cliente();
      return Promise.all([
        cli.from("partidas").select("version, estado_privado, updated_at").eq("user_id", uid).maybeSingle(),
        cli.from("profiles").select("avatar, updated_at").eq("id", uid).maybeSingle(),
        cli.from("salas").select("*").eq("user_id", uid).order("indice", { ascending: true })
      ]).then(function (res) {
        var rp = res[0], rpr = res[1], rs = res[2];
        if (rp.error) throw rp.error;
        if (rpr.error) throw rpr.error;
        if (rs.error) throw rs.error;
        var salasRows = rs.data || [];
        // guardar tokens updated_at de lo cargado (aunque la partida
        // esté vacía, para que un guardado posterior sea coherente)
        tokens = {
          partida: rp.data ? rp.data.updated_at : null,
          profile: rpr.data ? rpr.data.updated_at : null,
          salas: {}
        };
        salasRows.forEach(function (s) { tokens.salas[s.indice] = s.updated_at; });
        if (!salasRows.length) return null;   // partida vacía en la nube
        return reensamblarEstadoNube(rp.data, rpr.data, salasRows);
      });
    });
  }

  // Desglosa el estado y lo escribe en las 3 tablas. `partidas` y
  // `profiles` existen siempre (los crea el trigger al registrarse),
  // así que se actualizan; las `salas` se hacen upsert por (user_id,
  // indice). Devuelve true si escribió. (La concurrencia optimista
  // llega en T5.4; el dirty-diff/throttle en T5.6.)
  function guardar(estado) {
    return sesionUid().then(function (uid) {
      if (!uid) throw new Error("AlmacenNube.guardar: no hay sesión");
      var cli = cliente();
      var piezas = desglosarEstadoNube(estado);
      var conflictos = [];
      var ops = [];

      // Escritura condicionada: si hay token, exige updated_at igual;
      // 0 filas (data null) = conflicto. En éxito refresca el token.
      function condicional(q, token, refrescar, etiqueta) {
        if (token != null) q = q.eq("updated_at", token);
        ops.push(q.select("updated_at").maybeSingle().then(function (r) {
          if (r.error) throw r.error;
          if (!r.data) conflictos.push(etiqueta);   // afectó 0 filas
          else refrescar(r.data.updated_at);
        }));
      }

      // partidas
      condicional(
        cli.from("partidas").update({
          version: piezas.partida.version,
          estado_privado: piezas.partida.estado_privado
        }).eq("user_id", uid),
        tokens.partida, function (ts) { tokens.partida = ts; }, "partidas");

      // profiles
      condicional(
        cli.from("profiles").update({ avatar: piezas.profile.avatar }).eq("id", uid),
        tokens.profile, function (ts) { tokens.profile = ts; }, "profiles");

      // salas: existentes → update condicionado; nuevas (sin token) → insert
      piezas.salas.forEach(function (f) {
        var fila = {};
        Object.keys(f).forEach(function (k) { fila[k] = f[k]; });
        fila.user_id = uid;
        var tok = tokens.salas[f.indice];
        if (tok != null) {
          condicional(
            cli.from("salas").update(fila).eq("user_id", uid).eq("indice", f.indice),
            tok, function (ts) { tokens.salas[f.indice] = ts; }, "sala:" + f.indice);
        } else {
          ops.push(cli.from("salas").insert(fila).select("updated_at").maybeSingle().then(function (r) {
            if (r.error) throw r.error;
            if (r.data) tokens.salas[f.indice] = r.data.updated_at;
          }));
        }
      });

      return Promise.all(ops).then(function () {
        if (conflictos.length) {
          pendiente = estado;   // queda para que la UI avise / reintente
          var e = new Error("AlmacenNube.guardar: conflicto en " + conflictos.join(", ") +
            " (la partida cambió en otro sitio; recarga)");
          e.conflicto = true;
          throw e;
        }
        pendiente = null;
        return true;
      });
    });
  }

  // Carga la partida de la nube y, si está vacía (cargar() → null),
  // SIEMBRA una partida nueva con Juego.nuevaPartida(), la guarda y
  // la vuelve a cargar. No toca localStorage ni muestra modales.
  // Sin sesión, rechaza sin crear nada (T5.3).
  function cargarOSembrar() {
    return sesionUid().then(function (uid) {
      if (!uid) throw new Error("AlmacenNube.cargarOSembrar: no hay sesión");
      return cargar().then(function (estado) {
        if (estado) return estado;   // ya hay partida en la nube
        if (!(window.Juego && Juego.nuevaPartida)) {
          throw new Error("AlmacenNube.cargarOSembrar: falta Juego.nuevaPartida()");
        }
        var inicial = Juego.nuevaPartida();
        return guardar(inicial).then(function () { return cargar(); });
      });
    });
  }

  // Vacía la partida de la nube (borra las salas y limpia el blob
  // privado); tras esto, cargar() devuelve null. Sin sesión, rechaza.
  function reiniciar() {
    return sesionUid().then(function (uid) {
      if (!uid) throw new Error("AlmacenNube.reiniciar: no hay sesión");
      var cli = cliente();
      return Promise.all([
        cli.from("salas").delete().eq("user_id", uid),
        cli.from("partidas").update({ estado_privado: {} }).eq("user_id", uid)
      ]).then(function (res) {
        for (var i = 0; i < res.length; i++) {
          if (res[i] && res[i].error) throw res[i].error;
        }
        tokens = { partida: null, profile: null, salas: {} };
        pendiente = null;
        return true;
      });
    });
  }

  return {
    nombre: "nube",
    desglosarEstadoNube: desglosarEstadoNube,
    reensamblarEstadoNube: reensamblarEstadoNube,
    cargar: cargar,
    cargarOSembrar: cargarOSembrar,
    guardar: guardar,
    reiniciar: reiniciar,
    // estado que quedó sin guardar por un conflicto (o null)
    pendiente: function () { return pendiente; },
    // snapshot de los tokens updated_at (para depurar/probar)
    tokensActuales: function () {
      var s = {};
      Object.keys(tokens.salas).forEach(function (k) { s[k] = tokens.salas[k]; });
      return { partida: tokens.partida, profile: tokens.profile, salas: s };
    }
  };
})();
