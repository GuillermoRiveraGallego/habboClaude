"use strict";

// ============================================================
// REMOTOS — jugadores remotos (Fase Presence, P3.3).
//
// Un jugador remoto es, para el motor, un "NPC controlado por red":
// se dibuja con el cuerpo voxel del Avatar (intercambio temporal de
// aspecto, igual que Npcs), con nombre flotante y burbuja de chat, y
// se ordena en profundidad como una caja más en Sala.
//
// Esta fase NO usa red todavía: los actores se alimentan con datos
// MOCK locales (alta/actualizar/baja), tal y como llegarían de
// Presence/Broadcast en P3.4+. Aquí solo vive el RENDER y la
// INTERPOLACIÓN; nada se guarda (es 100% efímero).
//
// Modelo de cada actor:
//   Objetivo (lo que "llega por red"):
//     x, y   posición continua en coords de mundo (como avatar.x/y)
//     dir    0=+x 1=+y 2=−x 3=−y
//     pose   "parado" | "andando" | "sentado" | "bailando"
//     gz     altura al sentarse (0 si no)
//   Pintado (derivado localmente, NO viaja por red):
//     px, py     posición interpolada hacia (x, y)
//     dirVista   dirección mostrada (según el movimiento o el objetivo)
//     poseVista  pose mostrada (andar mientras se desplaza)
//     fase       fase de animación (se regenera aquí)
//   Burbuja:
//     frase, tVisible
//
// Diseño (ver docs/presence-arquitectura.md §12): el emisor manda
// posición objetivo + pose; la animación de andar y la fase se
// generan en el receptor. Los remotos NO bloquean el pathfinding.
// ============================================================
var Remotos = (function () {

  var VEL = 2.8;          // casillas/seg (igual que el avatar local)
  var SALTO = 3.0;        // distancia por encima de la cual se hace snap
  var LLEGADA = 0.02;     // umbral para considerar "llegó"

  var actores = {};       // id -> actor (efímero)

  // ---------------- altas / bajas / consultas ----------------

  // Da de alta (o reemplaza) un actor. En la aparición NO interpola:
  // px/py arrancan sobre el objetivo para que no "vuele" desde 0,0.
  function alta(datos) {
    datos = datos || {};
    var a = {
      id: datos.id,
      nombre: datos.nombre || "Jugador",
      aspecto: datos.aspecto || {},
      x: (datos.x != null) ? datos.x : 0,
      y: (datos.y != null) ? datos.y : 0,
      dir: datos.dir || 0,
      pose: datos.pose || "parado",
      gz: datos.gz || 0,
      px: 0, py: 0,
      dirVista: datos.dir || 0,
      poseVista: datos.pose || "parado",
      fase: 0,
      frase: null, tVisible: 0
    };
    a.px = a.x;
    a.py = a.y;
    actores[a.id] = a;
    return a;
  }

  // Actualiza el OBJETIVO de un actor ya existente (lo que movería un
  // evento de red). No toca px/py: el tick los lleva suavemente al
  // nuevo objetivo. Devuelve false si el actor no existe.
  function actualizar(id, cambios) {
    var a = actores[id];
    if (!a || !cambios) return false;
    if (cambios.x != null) a.x = cambios.x;
    if (cambios.y != null) a.y = cambios.y;
    if (cambios.dir != null) a.dir = cambios.dir;
    if (cambios.pose != null) a.pose = cambios.pose;
    if (cambios.gz != null) a.gz = cambios.gz;
    if (cambios.nombre != null) a.nombre = cambios.nombre;
    if (cambios.aspecto) a.aspecto = cambios.aspecto;
    return true;
  }

  function baja(id) {
    if (!actores[id]) return false;
    delete actores[id];
    return true;
  }

  function limpiar() { actores = {}; }

  function lista() {
    return Object.keys(actores).map(function (k) { return actores[k]; });
  }

  function obtener(id) { return actores[id] || null; }

  function cuenta() { return Object.keys(actores).length; }

  // Muestra una frase en burbuja sobre el actor (para el chat de P3.6).
  function decir(id, texto) {
    var a = actores[id];
    if (!a) return false;
    a.frase = texto;
    a.tVisible = 3.2;
    return true;
  }

  // ---------------- interpolación (tick) ----------------
  // Lo llama Sala en cada frame. Avanza px/py hacia (x, y) a VEL,
  // deriva la dirección del movimiento y anima la pose. En pruebas se
  // puede llamar con dt fijo para un avance determinista.
  function tick(dt) {
    Object.keys(actores).forEach(function (k) {
      var a = actores[k];
      if (a.tVisible > 0) a.tVisible -= dt;

      var dx = a.x - a.px, dy = a.y - a.py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var moviendo = dist > LLEGADA;

      if (moviendo && dist > SALTO) {
        // reaparición o salto grande: colocar directo, sin planeo
        a.px = a.x; a.py = a.y;
        moviendo = false;
      } else if (moviendo) {
        if (Math.abs(dx) > Math.abs(dy) + 0.001) a.dirVista = dx > 0 ? 0 : 2;
        else if (Math.abs(dy) > 0.001) a.dirVista = dy > 0 ? 1 : 3;
        var paso = VEL * dt;
        if (paso >= dist) { a.px = a.x; a.py = a.y; moviendo = false; }
        else { a.px += dx / dist * paso; a.py += dy / dist * paso; }
      }

      if (moviendo) {
        a.poseVista = "andando";
      } else {
        a.dirVista = a.dir;
        a.poseVista = a.pose || "parado";
      }

      if (a.poseVista === "andando") a.fase += dt * 11;
      else if (a.poseVista === "bailando") a.fase += dt * 9;
      else a.fase = 0;
    });
  }

  // ---------------- dibujo ----------------

  function alturaSentado(a) {
    return (a.poseVista === "sentado") ? (a.gz || 0.5) : 0;
  }

  // Caja envolvente para el orden de pintado de la sala.
  function caja(a) {
    var m = 0.34;
    var gz = alturaSentado(a);
    return {
      x0: a.px - m, y0: a.py - m, z0: 0,
      x1: a.px + m, y1: a.py + m, z1: gz + 1.7
    };
  }

  function dibujar(ctx, a) {
    var previo = Juego.aspecto();
    var gz = alturaSentado(a);
    Avatar.ponAspecto(a.aspecto);
    Avatar.dibujar(ctx, {
      x: a.px, y: a.py, dir: a.dirVista,
      pose: a.poseVista, fase: a.fase, gz: gz
    });
    Avatar.ponAspecto(previo);

    // burbuja de chat (misma técnica que las frases de ambiente)
    if (a.tVisible > 0 && a.frase) {
      var pb = Iso.proyectar(a.px, a.py, 1.75 + 0.4);
      ctx.font = "11px 'Trebuchet MS', 'Segoe UI', sans-serif";
      var wb = ctx.measureText(a.frase).width + 14;
      var alfaB = Math.min(1, a.tVisible / 0.4);
      ctx.globalAlpha = alfaB;
      ctx.fillStyle = "rgba(242, 239, 230, 0.94)";
      ctx.fillRect(pb.x - wb / 2, pb.y - 17, wb, 17);
      ctx.fillStyle = "#343740";
      ctx.textAlign = "center";
      ctx.fillText(a.frase, pb.x, pb.y - 5);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }

    // nombre flotante sobre la cabeza (tinte propio para distinguir
    // a los jugadores remotos de los NPC fijos/visitantes)
    var p = Iso.proyectar(a.px, a.py, 1.75);
    ctx.font = "bold 10px 'Trebuchet MS', 'Segoe UI', sans-serif";
    var w = ctx.measureText(a.nombre).width + 12;
    ctx.fillStyle = "rgba(44, 90, 116, 0.82)";
    ctx.fillRect(p.x - w / 2, p.y - 15, w, 14);
    ctx.fillStyle = "#eaf4f7";
    ctx.textAlign = "center";
    ctx.fillText(a.nombre, p.x, p.y - 4.5);
    ctx.textAlign = "left";
  }

  return {
    alta: alta,
    actualizar: actualizar,
    baja: baja,
    limpiar: limpiar,
    lista: lista,
    obtener: obtener,
    cuenta: cuenta,
    decir: decir,
    tick: tick,
    caja: caja,
    dibujar: dibujar
  };
})();
