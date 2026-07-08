"use strict";

// ============================================================
// MODAL — sistema único de ventanas del juego (fase POLISH).
//
// Dos piezas:
//   · Modal: comportamiento común de TODO overlay (modales y
//     paneles). Un modal comparte backdrop a pantalla completa,
//     microanimación de entrada/salida y las MISMAS reglas de
//     cierre: botón ✕, clic/toque fuera y tecla Escape.
//   · Dialogo: confirmar acciones y pedir texto con la estética
//     del juego, en sustitución de window.confirm/window.prompt.
//
// Diseño:
//   - registrar(fondo): reviste un modal ya construido (mantiene
//     su markup/ids/CSS) añadiéndole abrir/cerrar animados y el
//     cableado de ✕ + clic fuera. Lo usan Minijuegos, Casino,
//     Cuenta y el propio Dialogo.
//   - registrarPanel(...): da a los paneles sin backdrop (panel
//     lateral, panel de mascota, chat) y a la colocación activa
//     las mismas reglas de cierre, sin convertirlos en modales.
//   - Un ÚNICO manejador de Escape (cierra el overlay abierto de
//     mayor nivel) y uno de clic/toque fuera, centralizados aquí,
//     para que el usuario nunca dude de cómo se cierra una ventana.
//
// Niveles (prioridad de Escape): colocación 3 > modal 2 > panel 1.
// ============================================================
var Modal = (function () {

  var DUR = 200;      // ms — igual que la transición CSS de .modal-fondo
  var lista = [];     // cerrables registrados

  function agregar(e) { lista.push(e); return e; }

  // --------------------------------------------------------
  // Reviste un modal con carcasa (backdrop .modal-fondo con una
  // .modal-caja dentro y, opcional, un botón .modal-cerrar).
  // Devuelve { abrir, cerrar, estaAbierto }.
  // --------------------------------------------------------
  function registrar(fondo, op) {
    op = op || {};
    var abierto = false, temp = null;

    function estaAbierto() { return abierto; }

    function abrir() {
      abierto = true;
      clearTimeout(temp);
      fondo.classList.remove("oculto");
      void fondo.offsetWidth;              // reflujo → arranca la transición
      fondo.classList.add("visible");
      if (op.alAbrir) op.alAbrir();
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;
      fondo.classList.remove("visible");
      temp = setTimeout(function () { fondo.classList.add("oculto"); }, DUR);
      if (op.alCerrar) op.alCerrar();
    }

    var x = fondo.querySelector(".modal-cerrar");
    if (x) x.addEventListener("click", cerrar);
    fondo.addEventListener("click", function (e) { if (e.target === fondo) cerrar(); });

    agregar({
      nivel: op.nivel || 2,
      estaAbierto: estaAbierto,
      cerrar: cerrar,
      esParte: function (n) { return fondo.contains(n); },
      fueraCierra: false                    // el backdrop ya gestiona el "fuera"
    });

    return { abrir: abrir, cerrar: cerrar, estaAbierto: estaAbierto };
  }

  // --------------------------------------------------------
  // Da a un panel/overlay SIN backdrop las mismas reglas de cierre.
  //   op: { estaAbierto, cerrar, esParte?, esDisparador?,
  //         fueraCierra?, puedeCerrarFuera?, nivel? }
  // --------------------------------------------------------
  function registrarPanel(op) {
    return agregar({
      nivel: op.nivel || 1,
      estaAbierto: op.estaAbierto,
      cerrar: op.cerrar,
      esParte: op.esParte || function () { return false; },
      esDisparador: op.esDisparador || function () { return false; },
      fueraCierra: op.fueraCierra !== false,
      puedeCerrarFuera: op.puedeCerrarFuera || function () { return true; }
    });
  }

  // Escape: cierra el overlay ABIERTO de mayor nivel (y solo ese).
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var mejor = null;
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i];
      if (c.estaAbierto && c.estaAbierto() && (!mejor || c.nivel >= mejor.nivel)) mejor = c;
    }
    if (mejor) { mejor.cerrar(); e.stopPropagation(); e.preventDefault(); }
  }, true);

  // Clic/toque fuera: cierra los paneles con fueraCierra cuyo objetivo
  // no forme parte del panel ni de su disparador.
  function fuera(e) {
    var t = e.target;
    // Un clic sobre un modal (o su backdrop) lo gestiona el propio modal;
    // no debe cerrar paneles que quedan por debajo.
    if (t && t.closest && t.closest(".modal-fondo")) return;
    lista.forEach(function (c) {
      if (!c.fueraCierra || !c.estaAbierto || !c.estaAbierto()) return;
      if (c.esParte(t) || c.esDisparador(t)) return;
      if (!c.puedeCerrarFuera()) return;
      c.cerrar();
    });
  }
  document.addEventListener("mousedown", fuera, true);
  document.addEventListener("touchstart", fuera, true);

  return {
    registrar: registrar,
    registrarPanel: registrarPanel,
    // para pruebas
    depurar: { abiertos: function () {
      return lista.filter(function (c) { return c.estaAbierto && c.estaAbierto(); }).length;
    } }
  };
})();

// ============================================================
// DIALOGO — confirmar acciones y pedir texto con el estilo del
// juego. Sustituye a window.confirm/window.prompt. Basado en Modal,
// así que hereda backdrop, animación y reglas de cierre. Reutilizable
// desde cualquier módulo: Dialogo.confirmar({...}) / Dialogo.pedir({...}).
// ============================================================
var Dialogo = (function () {

  var api = null, fondo, titulo, msg, input, botones, btnOk, btnCancel;
  var cfg = null, finalizado = true;

  function construir() {
    if (api) return;
    fondo = document.createElement("div");
    fondo.className = "modal-fondo oculto";
    fondo.id = "modal-fondo-dialogo";
    fondo.innerHTML =
      '<div class="modal-caja modal-dialogo">' +
        '<div class="modal-barra"><span class="modal-titulo" id="dlg-titulo"></span>' +
        '<button class="modal-cerrar" id="dlg-x" type="button" title="Cerrar" aria-label="Cerrar">✕</button></div>' +
        '<div class="modal-contenido">' +
          '<p class="dlg-mensaje" id="dlg-mensaje"></p>' +
          '<input class="dlg-input oculto" id="dlg-input" type="text" autocomplete="off">' +
          '<div class="dlg-botones">' +
            '<button class="dlg-btn dlg-cancelar" id="dlg-cancelar" type="button"></button>' +
            '<button class="dlg-btn dlg-aceptar" id="dlg-aceptar" type="button"></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(fondo);
    titulo = fondo.querySelector("#dlg-titulo");
    msg = fondo.querySelector("#dlg-mensaje");
    input = fondo.querySelector("#dlg-input");
    botones = fondo.querySelector(".dlg-botones");
    btnOk = fondo.querySelector("#dlg-aceptar");
    btnCancel = fondo.querySelector("#dlg-cancelar");

    // alCerrar salta con ✕, clic fuera o Escape → equivale a cancelar
    api = Modal.registrar(fondo, { alCerrar: function () { resolver(false); } });

    btnOk.addEventListener("click", function () { resolver(true, input.value); api.cerrar(); });
    btnCancel.addEventListener("click", function () { api.cerrar(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); resolver(true, input.value); api.cerrar(); }
    });
  }

  // Dispara el resultado una sola vez por diálogo.
  function resolver(ok, valor) {
    if (finalizado) return;
    finalizado = true;
    var c = cfg; cfg = null;
    if (ok) { if (c && c.alAceptar) c.alAceptar(valor); }
    else if (c && c.alCancelar) c.alCancelar();
  }

  function base(op, esPrompt) {
    construir();
    if (!finalizado) resolver(false);   // cierra un diálogo previo pendiente
    cfg = op; finalizado = false;

    titulo.textContent = op.titulo || (esPrompt ? "Escribe" : "Confirmar");
    msg.innerHTML = op.mensaje || "";
    btnOk.textContent = op.aceptar || (esPrompt ? "Aceptar" : "Sí");
    btnCancel.textContent = op.cancelar || "Cancelar";
    btnOk.classList.toggle("peligro", !!op.peligro);

    if (esPrompt) {
      input.classList.remove("oculto");
      input.value = op.valor || "";
      if (op.placeholder) input.setAttribute("placeholder", op.placeholder);
      else input.removeAttribute("placeholder");
      if (op.maxlargo) input.setAttribute("maxlength", op.maxlargo);
      else input.removeAttribute("maxlength");
    } else {
      input.classList.add("oculto");
    }

    api.abrir();
    if (esPrompt) { input.focus(); input.select(); }
  }

  return {
    confirmar: function (op) { base(op || {}, false); },
    pedir: function (op) { base(op || {}, true); }
  };
})();
