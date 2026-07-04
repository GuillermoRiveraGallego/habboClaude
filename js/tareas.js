"use strict";

// ============================================================
// TAREAS — tareas diarias con recompensas en créditos y
// desbloqueos. Todo basado en datos: la lista TAREAS define
// cada reto y, opcionalmente, qué desbloquea al reclamarlo
// (una clave de Juego.recompensas(): furnis del catálogo o
// habilidades como "bailar").
//
// Los módulos del juego avisan del avance con
// Tareas.evento(tipo, dato) — "minijuego", "gasto", "npc",
// "sala", "mascota" — y aquí se traduce a progreso. El estado
// (fecha, progreso, reclamadas...) vive en Juego.estado().tareas
// y se reinicia solo al cambiar de día (comprobarDia se llama
// antes de cada lectura o avance).
// ============================================================
var Tareas = (function () {

  var TAREAS = [
    { id: "jugon", icono: "💻", nombre: "Maratón de minijuegos",
      desc: "Juega a los 5 minijuegos del ordenador", meta: 5, recompensa: 10000 },
    { id: "decorador", icono: "🛋️", nombre: "Decorador del día",
      desc: "Gasta 50.000 créditos en el catálogo", meta: 50000, recompensa: 25000,
      desbloquea: { clave: "bola_disco", regalo: "Bola de disco en el catálogo",
                    aviso: "🪩 ¡Bola de disco desbloqueada en el catálogo!" } },
    { id: "sociable", icono: "💬", nombre: "Don de gentes",
      desc: "Habla con 3 vecinos distintos (¡o con quien esté de visita!)", meta: 3, recompensa: 3000 },
    { id: "fiestero", icono: "🎉", nombre: "Noche de fiesta",
      desc: "Visita la Sala de Baile", meta: 1, recompensa: 2000,
      desbloquea: { clave: "bailar", regalo: "Tu avatar aprende a bailar",
                    aviso: "🕺 ¡Tu avatar ya sabe bailar! Déjalo quieto en la pista" } },
    { id: "cuidador", icono: "🐾", nombre: "Amigo de los animales",
      desc: "Alimenta o juega con tus mascotas 3 veces", meta: 3, recompensa: 3000 }
  ];

  var cbCambio = null; // (def, recienCompletada) → la UI avisa y repinta

  function porId(id) {
    for (var i = 0; i < TAREAS.length; i++) if (TAREAS[i].id === id) return TAREAS[i];
    return null;
  }

  function fechaHoy() {
    var d = new Date();
    return d.getFullYear() + "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
      ("0" + d.getDate()).slice(-2);
  }

  // Si ha cambiado el día, el progreso vuelve a cero (los
  // desbloqueos ya reclamados NO se pierden: viven en
  // Juego.recompensas(), que es permanente).
  function comprobarDia() {
    var t = Juego.tareas();
    var hoy = fechaHoy();
    if (t.fecha !== hoy) {
      t.fecha = hoy;
      t.progreso = {};
      t.reclamadas = {};
      t.juegosHoy = [];
      t.npcsHoy = [];
    }
  }

  function datos() {
    comprobarDia();
    return Juego.tareas();
  }

  // ---------------- consultas ----------------

  function lista() { return TAREAS; }

  function progresoDe(id) { return datos().progreso[id] || 0; }

  // "pendiente" | "progreso" | "completada" | "reclamada"
  function estadoDe(id) {
    var t = datos(), def = porId(id);
    if (t.reclamadas[id]) return "reclamada";
    var p = t.progreso[id] || 0;
    if (p >= def.meta) return "completada";
    return p > 0 ? "progreso" : "pendiente";
  }

  // ---------------- avance ----------------

  function avanzar(id, n) {
    if (!n) return;
    var t = datos(), def = porId(id);
    var antes = t.progreso[id] || 0;
    if (antes >= def.meta) return; // ya completada
    t.progreso[id] = Math.min(def.meta, antes + n);
    if (cbCambio) cbCambio(def, t.progreso[id] >= def.meta);
  }

  // Gancho que llaman Juego, Mascotas y la UI del chat
  function evento(tipo, dato) {
    var t = datos();
    if (tipo === "minijuego") {
      if (t.juegosHoy.indexOf(dato) === -1) {
        t.juegosHoy.push(dato);
        avanzar("jugon", 1);
      }
    } else if (tipo === "gasto") {
      avanzar("decorador", dato);
    } else if (tipo === "npc") {
      if (t.npcsHoy.indexOf(dato) === -1) {
        t.npcsHoy.push(dato);
        avanzar("sociable", 1);
      }
    } else if (tipo === "sala") {
      if (dato === "baile") avanzar("fiestero", 1);
    } else if (tipo === "mascota") {
      avanzar("cuidador", 1);
    }
  }

  // ---------------- recompensa ----------------

  function reclamar(id) {
    var t = datos(), def = porId(id);
    if (!def || t.reclamadas[id] || (t.progreso[id] || 0) < def.meta) return false;
    t.reclamadas[id] = true;
    Juego.ganar(def.recompensa); // dispara cambio() → autoguardado
    if (def.desbloquea) Juego.desbloquearRecompensa(def.desbloquea.clave);
    if (cbCambio) cbCambio(def, false);
    return true;
  }

  return {
    lista: lista,
    evento: evento,
    reclamar: reclamar,
    estadoDe: estadoDe,
    progresoDe: progresoDe,
    comprobarDia: comprobarDia,
    ponAlCambiar: function (fn) { cbCambio = fn; }
  };
})();
