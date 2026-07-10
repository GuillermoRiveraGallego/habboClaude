"use strict";

// ============================================================
// VISITA — modo visitante de salas ajenas (Fase Presence, P3.7).
//
// FUENTE ÚNICA DE VERDAD del estado "¿la sala cargada es mía o la
// estoy visitando?". El resto del juego consulta `soloLectura()` en
// vez de esparcir comprobaciones tipo `if (soyVisitante)`.
//
// Responsabilidades (y solo estas):
//   - saber si la sala actual es propia (editable) o ajena (solo lectura);
//   - cargar el decorado del propietario (lectura pública vía `Nube`);
//   - entrar/salir de la visita, delegando el render en `Sala` y la
//     presencia/canal en `Presencia` (que lee `objetivo()` para usar el
//     canal del DUEÑO, no el del visitante).
//
// NO toca Guardado ni el estado persistente: la sala visitada es un
// objeto EFÍMERO y detached (nunca entra en `Juego.estado().salas`),
// así que ninguna acción sobre ella puede llegar a persistirse.
// NO llama a Supabase directamente: todo pasa por `Nube`.
//
// Alcance P3.7: solo visitar (caminar, mirar, chatear, ver a otros).
// Sin amigos, salas públicas, invitaciones ni permisos avanzados.
// ============================================================
var Visita = (function () {

  // null = estoy en una sala propia (editable).
  // objeto = estoy visitando { ownerUserId, indice, nombre }.
  var objetivoActual = null;
  var oyentes = [];

  // ---- fila (tabla salas) -> objeto de sala para render ----
  // Espeja AlmacenNube.filaASala, pero SOLO para pintar (lectura):
  // no se reutiliza aquella para no acoplar la persistencia a la visita.
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
    if (fila.tipo) sala.tipo = fila.tipo;
    return sala;
  }

  // ---- estado central ----
  function objetivo() { return objetivoActual; }
  function soloLectura() { return !!objetivoActual; }
  // índice EFECTIVO de la sala cargada (el del dueño si visito; el mío si no)
  function indice() {
    if (objetivoActual) return objetivoActual.indice;
    return (window.Juego && Juego.indiceSala) ? Juego.indiceSala() : 0;
  }
  function nombreVisita() { return objetivoActual ? objetivoActual.nombre : null; }
  function estado() {
    return {
      visitando: soloLectura(),
      ownerUserId: objetivoActual ? objetivoActual.ownerUserId : null,
      indice: objetivoActual ? objetivoActual.indice : null,
      nombre: objetivoActual ? objetivoActual.nombre : null
    };
  }

  // oyentes: la UI se suscribe para habilitar/inhabilitar el "chrome"
  // de edición y refrescar el HUD al entrar/salir de una visita.
  function alCambiar(cb) { if (cb) oyentes.push(cb); }
  function notificar() {
    for (var i = 0; i < oyentes.length; i++) {
      try { oyentes[i](soloLectura()); } catch (e) {}
    }
  }

  // ---- entrar / salir ----
  // Carga la sala <ownerUserId, idx> en solo lectura. Devuelve una
  // Promesa que resuelve true si se cargó, false si no existe / sin nube.
  function entrar(ownerUserId, idx) {
    if (!window.Nube || !Nube.leerSala || !window.Sala) return Promise.resolve(false);
    return Nube.leerSala(ownerUserId, idx).then(function (fila) {
      if (!fila) return false;
      var sala = filaASala(fila);
      // fijar el objetivo ANTES de cargar: así el aviso de "sala
      // cargada" hace que Presencia abra el canal del DUEÑO.
      objetivoActual = { ownerUserId: ownerUserId, indice: idx, nombre: sala.nombre };
      Sala.cargar(sala);
      notificar();
      return true;
    }).catch(function (e) {
      console.warn("Visita.entrar:", e && e.message);
      return false;
    });
  }

  // Vuelve a la sala propia actual. Seguro aunque no se esté visitando.
  function salir() {
    if (!objetivoActual) return Promise.resolve(false);
    objetivoActual = null;
    if (window.Sala && window.Juego) Sala.cargar(Juego.salaActual());
    notificar();
    return Promise.resolve(true);
  }

  return {
    objetivo: objetivo,
    soloLectura: soloLectura,
    indice: indice,
    nombreVisita: nombreVisita,
    estado: estado,
    alCambiar: alCambiar,
    entrar: entrar,
    salir: salir
  };
})();
