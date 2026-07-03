"use strict";

// ============================================================
// AMBIENTE — ciclo día/noche (idea 4).
//
// Cuatro fases que tiñen la paleta completa (y con ella todo
// el juego): mañana, tarde, atardecer y noche. Por defecto la
// fase sigue la HORA REAL del reloj ("auto"); desde el HUD se
// puede forzar una fase concreta, y la elección se guarda con
// la partida (Juego.estado().ambiente).
//
// De noche y al atardecer las lámparas, el farol, la chimenea,
// la tele y el ordenador se "encienden": la sala les dibuja un
// halo de luz (ver def.luz en furnis.js y sala.js).
// ============================================================
var Ambiente = (function () {

  var FASES = ["manana", "tarde", "atardecer", "noche"];
  var INFO = {
    manana:    { nombre: "Mañana",    emoji: "🌅" },
    tarde:     { nombre: "Tarde",     emoji: "☀️" },
    atardecer: { nombre: "Atardecer", emoji: "🌇" },
    noche:     { nombre: "Noche",     emoji: "🌙" }
  };

  var alCambiar = null;

  // hora real → fase (pura, para poder probarla)
  function faseDeHora(h) {
    if (h >= 7 && h < 13) return "manana";
    if (h >= 13 && h < 19) return "tarde";
    if (h >= 19 && h < 22) return "atardecer";
    return "noche";
  }

  function modo() {
    if (window.Juego && Juego.estado()) return Juego.ambiente() || "auto";
    return "auto";
  }

  function fase() {
    var m = modo();
    return m === "auto" ? faseDeHora(new Date().getHours()) : m;
  }

  // ¿lámparas y pantallas encendidas?
  function lucesEncendidas() {
    var f = fase();
    return f === "noche" || f === "atardecer";
  }

  function aplicar() {
    var f = fase();
    Paleta.ponAmbiente(f);
    FASES.forEach(function (x) { document.body.classList.remove("fase-" + x); });
    document.body.classList.add("fase-" + f);
    if (alCambiar) alCambiar(f, modo());
  }

  // ciclo del botón del HUD: auto → mañana → ... → noche → auto
  function siguiente() {
    var orden = ["auto"].concat(FASES);
    var i = orden.indexOf(modo());
    Juego.cambiarAmbiente(orden[(i + 1) % orden.length]);
    aplicar();
  }

  function etiqueta() {
    var f = fase(), m = modo();
    return INFO[f].emoji + " " + (m === "auto" ? "Auto · " + INFO[f].nombre : INFO[f].nombre);
  }

  function iniciar() {
    aplicar();
    // en modo auto, la fase cambia sola con la hora real
    setInterval(function () {
      if (modo() === "auto") aplicar();
    }, 60000);
  }

  return {
    iniciar: iniciar,
    aplicar: aplicar,
    fase: fase,
    faseDeHora: faseDeHora,
    modo: modo,
    siguiente: siguiente,
    etiqueta: etiqueta,
    lucesEncendidas: lucesEncendidas,
    ponAlCambiar: function (fn) { alCambiar = fn; }
  };
})();
