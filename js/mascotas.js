"use strict";

// ============================================================
// MASCOTAS — sistema de mascotas del jardín (ideas 1 y 1.2).
//
// - Los perros y gatos pasean libres por el jardín.
// - Los peces viven en un acuario y los pájaros en un aviario
//   colocados en el jardín (con capacidad limitada).
// - Cada mascota tiene Hambre (saciedad), Felicidad y Energía
//   (0-100) que decaen con el tiempo de juego, y un estado
//   visual con 3 niveles: contento / normal / triste.
// - Acciones: alimentar (consume comida comprada por tipo) y
//   jugar (con enfriamiento, gasta energía).
// - Felicidad global del jardín: mantenerla alta desbloquea
//   furnis decorativos exclusivos (recompensa no monetaria).
//
// El estado persistente vive en Juego (listo para el guardado
// de la siguiente fase); aquí solo hay lógica y estado efímero
// (posiciones, animaciones) que no debe guardarse.
// ============================================================
var Mascotas = (function () {

  var TIPOS = {
    perro: {
      nombre: "Perro", precio: 350, emoji: "🐕", libre: true,
      sugerencias: ["Toby", "Luna", "Rocky", "Nala"]
    },
    gato: {
      nombre: "Gato", precio: 300, emoji: "🐈", libre: true,
      sugerencias: ["Michi", "Coco", "Mía", "Simba"]
    },
    pez: {
      nombre: "Pez", precio: 120, emoji: "🐟", libre: false,
      hogar: "acuario", porHogar: 3,
      sugerencias: ["Burbujas", "Nemo", "Perla", "Coral"]
    },
    pajaro: {
      nombre: "Pájaro", precio: 180, emoji: "🐦", libre: false,
      hogar: "aviario", porHogar: 2,
      sugerencias: ["Kiwi", "Pío", "Cielo", "Mango"]
    }
  };

  var COMIDA = {
    perro:  { nombre: "Comida para perro",   precio: 12 },
    gato:   { nombre: "Comida para gato",    precio: 12 },
    pez:    { nombre: "Comida para peces",   precio: 8 },
    pajaro: { nombre: "Comida para pájaros", precio: 10 }
  };

  var COLORES_PEZ = ["naranja", "amarillo", "rosa"];

  // Estado efímero por mascota (posición, animación) — NO se guarda
  var runtime = {};
  var alRecompensa = null;

  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  function estadoDe(m) {
    if (m.felicidad >= 66) return "contento";
    if (m.felicidad >= 33) return "normal";
    return "triste";
  }

  function emojiEstado(e) {
    return e === "contento" ? "😊" : e === "normal" ? "😐" : "😢";
  }

  // ---------------- jardín y hogares ----------------

  function jardin() {
    var salas = Juego.salas();
    for (var i = 0; i < salas.length; i++) {
      if (salas[i].tipo === "jardin") return salas[i];
    }
    return null;
  }

  function hogaresEnJardin(idFurni) {
    var j = jardin();
    if (!j || !j.desbloqueada) return [];
    return j.furnis.filter(function (f) { return f.id === idFurni; });
  }

  function habitantesDe(uidHogar) {
    return Juego.mascotas().filter(function (m) { return m.hogarUid === uidHogar; });
  }

  function hogarConHueco(tipo) {
    var t = TIPOS[tipo];
    if (!t.hogar) return null;
    var hs = hogaresEnJardin(t.hogar);
    for (var i = 0; i < hs.length; i++) {
      if (habitantesDe(hs[i].uid).length < t.porHogar) return hs[i];
    }
    return null;
  }

  // ---------------- compra ----------------

  function puedeComprar(tipo) {
    var t = TIPOS[tipo];
    var j = jardin();
    if (!j || !j.desbloqueada) return { ok: false, error: "Desbloquea El Jardín primero" };
    if (Juego.creditos() < t.precio) return { ok: false, error: "No tienes créditos suficientes" };
    if (t.hogar && !hogarConHueco(tipo)) {
      return {
        ok: false,
        error: tipo === "pez"
          ? "Necesitas un acuario con hueco colocado en el jardín"
          : "Necesitas un aviario con hueco colocado en el jardín"
      };
    }
    return { ok: true };
  }

  function comprar(tipo, nombre) {
    var r = puedeComprar(tipo);
    if (!r.ok) return r;
    var t = TIPOS[tipo];
    if (!Juego.gastar(t.precio)) return { ok: false, error: "No tienes créditos suficientes" };
    var hogar = hogarConHueco(tipo);
    var m = Juego.nuevaMascota(tipo, nombre || t.sugerencias[0], hogar ? hogar.uid : null);
    return { ok: true, mascota: m };
  }

  // ---------------- acciones ----------------

  function alimentar(m) {
    if (!Juego.consumirComida(m.tipo)) {
      return { ok: false, error: "No tienes " + COMIDA[m.tipo].nombre.toLowerCase() + ". Cómprala en la tienda." };
    }
    m.hambre = clamp(m.hambre + 45);
    m.energia = clamp(m.energia + 15);
    m.felicidad = clamp(m.felicidad + 8);
    m.ultimaComida = Date.now();
    if (window.Tareas) Tareas.evento("mascota");
    return { ok: true };
  }

  function jugar(m) {
    var ahora = Date.now();
    if (m.ultimoJuego && ahora - m.ultimoJuego < 30000) {
      return { ok: false, error: m.nombre + " necesita un respiro entre juego y juego" };
    }
    if (m.energia < 20) {
      return { ok: false, error: m.nombre + " no tiene energía. Comida y descanso." };
    }
    m.felicidad = clamp(m.felicidad + 20);
    m.energia = clamp(m.energia - 20);
    m.ultimoJuego = ahora;
    var rt = runtime[m.uid];
    if (rt) rt.saltoHasta = performance.now() + 1600;
    if (window.Tareas) Tareas.evento("mascota");
    return { ok: true };
  }

  // ---------------- simulación ----------------

  function casillaLibreAleatoria(ctx) {
    for (var i = 0; i < 80; i++) {
      var x = (Math.random() * ctx.ancho) | 0;
      var y = (Math.random() * ctx.fondo) | 0;
      if (ctx.libre(x, y)) return { x: x, y: y };
    }
    return { x: 0, y: 0 };
  }

  function asegurarRuntime(m, ctx) {
    var rt = runtime[m.uid];
    if (rt) return rt;
    var pos = ctx ? casillaLibreAleatoria(ctx) : { x: 0, y: 0 };
    rt = runtime[m.uid] = {
      x: pos.x + 0.5, y: pos.y + 0.5,
      dir: (Math.random() * 4) | 0,
      objetivo: null,
      espera: Math.random() * 2,
      pose: "normal",
      saltoHasta: 0
    };
    return rt;
  }

  function moverSuelto(m, dt, ctx) {
    var rt = asegurarRuntime(m, ctx);

    // descanso: recupera energía quieto
    if (rt.pose === "descansa") {
      if (m.energia > 70) rt.pose = "normal";
      else return;
    } else if (m.energia < 22) {
      rt.pose = "descansa";
      rt.objetivo = null;
      return;
    }

    if (rt.objetivo) {
      var dx = rt.objetivo.x - rt.x, dy = rt.objetivo.y - rt.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var vel = estadoDe(m) === "triste" ? 0.7 : 1.3;
      if (Math.abs(dx) > Math.abs(dy) + 0.01) rt.dir = dx > 0 ? 0 : 2;
      else if (Math.abs(dy) > 0.01) rt.dir = dy > 0 ? 1 : 3;
      var paso = vel * dt;
      if (paso >= dist) {
        rt.x = rt.objetivo.x;
        rt.y = rt.objetivo.y;
        rt.objetivo = null;
        rt.espera = 0.6 + Math.random() * (estadoDe(m) === "triste" ? 4 : 2);
      } else {
        rt.x += dx / dist * paso;
        rt.y += dy / dist * paso;
      }
    } else {
      rt.espera -= dt;
      if (rt.espera <= 0) {
        var cx = Math.floor(rt.x), cy = Math.floor(rt.y);
        var opciones = [];
        for (var dy2 = -1; dy2 <= 1; dy2++) {
          for (var dx2 = -1; dx2 <= 1; dx2++) {
            if (!dx2 && !dy2) continue;
            var nx = cx + dx2, ny = cy + dy2;
            if (!ctx.libre(nx, ny)) continue;
            if (dx2 && dy2 && (!ctx.libre(cx + dx2, cy) || !ctx.libre(cx, cy + dy2))) continue;
            opciones.push({ x: nx + 0.5, y: ny + 0.5 });
          }
        }
        if (opciones.length) rt.objetivo = opciones[(Math.random() * opciones.length) | 0];
        else rt.espera = 1;
      }
    }
  }

  // Avanza estadísticas de TODAS las mascotas; mueve a las
  // sueltas solo si el jardín está cargado (ctxJardin != null).
  function tick(dt, ctxJardin) {
    var lista = Juego.mascotas();
    if (!lista.length) return;
    var suma = 0;

    lista.forEach(function (m) {
      var rt = runtime[m.uid];
      var moviendo = !!(rt && rt.objetivo);
      var descansando = !!(rt && rt.pose === "descansa");

      m.hambre = clamp(m.hambre - dt * 100 / 480);      // vacía en ~8 min
      if (m.hambre > 70 && m.energia > 50) {
        m.felicidad = clamp(m.felicidad + dt * 1.0);    // bien cuidado → sube
      } else {
        m.felicidad = clamp(m.felicidad - dt * (100 / 720) * (m.hambre < 30 ? 2.5 : 1));
      }
      var dE = moviendo ? -2 : (descansando ? 5 : (m.hambre > 60 ? 1.5 : -0.4));
      m.energia = clamp(m.energia + dt * dE);
      suma += m.felicidad;

      if (TIPOS[m.tipo].libre && ctxJardin) moverSuelto(m, dt, ctxJardin);
    });

    // felicidad global del jardín → recompensas exclusivas
    var media = suma / lista.length;
    if (lista.length >= 3 && media >= 80 && Juego.desbloquearRecompensa("fuente")) {
      if (alRecompensa) alRecompensa("fuente", "¡Fuente de piedra desbloqueada! Tus mascotas son muy felices");
    }
    if (lista.length >= 5 && media >= 85 && Juego.desbloquearRecompensa("gnomo")) {
      if (alRecompensa) alRecompensa("gnomo", "¡Gnomo de jardín desbloqueado! Tu jardín es un paraíso");
    }
  }

  function felicidadGlobal() {
    var lista = Juego.mascotas();
    if (!lista.length) return null;
    var suma = 0;
    lista.forEach(function (m) { suma += m.felicidad; });
    return Math.round(suma / lista.length);
  }

  // ---------------- dibujo ----------------
  // (mismas piezas locales que el avatar: a = avance según la
  //  mirada, b = lateral; heredan la luz de las primitivas)

  var DIRS = [
    { fx: 1, fy: 0 }, { fx: 0, fy: 1 }, { fx: -1, fy: 0 }, { fx: 0, fy: -1 }
  ];

  function parte(L, cx, cy, dir, a, b, df, ds, z0, z1, color) {
    var D = DIRS[dir], sx = -D.fy, sy = D.fx;
    var ox = cx + D.fx * a + sx * b;
    var oy = cy + D.fy * a + sy * b;
    var tx = Math.abs(D.fx) * df + Math.abs(sx) * ds;
    var ty = Math.abs(D.fy) * df + Math.abs(sy) * ds;
    L.push({ x0: ox - tx / 2, y0: oy - ty / 2, z0: z0, x1: ox + tx / 2, y1: oy + ty / 2, z1: z1, color: color });
  }

  function pintarPartes(ctx, L) {
    var orden = Iso.ordenarCajas(L);
    for (var i = 0; i < orden.length; i++) {
      var p = orden[i];
      Iso.cubo(ctx, p.x0, p.y0, p.z0, p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0, p.color);
    }
  }

  function partesPerro(m, rt, t) {
    var L = [], cx = rt.x, cy = rt.y, d = rt.dir;
    var e = estadoDe(m);
    var g = 0;
    if (performance.now() < rt.saltoHasta) g = Math.abs(Math.sin(t * 10)) * 0.16;
    else if (e === "contento" && rt.objetivo) g = Math.abs(Math.sin(t * 7)) * 0.05;
    var sw = rt.objetivo ? Math.sin(t * 9) * 0.05 : 0;

    if (rt.pose === "descansa") {
      parte(L, cx, cy, d, -0.02, 0, 0.46, 0.26, 0, 0.16, "marron");        // cuerpo tumbado
      parte(L, cx, cy, d, 0.27, 0, 0.18, 0.18, 0.04, 0.24, "marron");      // cabeza
      parte(L, cx, cy, d, 0.39, 0, 0.06, 0.10, 0.06, 0.14, "crema");       // hocico
      parte(L, cx, cy, d, 0.22, -0.105, 0.05, 0.03, 0.10, 0.20, "madera_oscura"); // orejas caídas
      parte(L, cx, cy, d, 0.22, 0.105, 0.05, 0.03, 0.10, 0.20, "madera_oscura");
      parte(L, cx, cy, d, -0.28, 0.08, 0.10, 0.05, 0, 0.05, "marron");     // cola en el suelo
      return L;
    }

    var zc = e === "triste" ? -0.08 : 0;
    // patas
    parte(L, cx, cy, d, 0.14 + sw, -0.07, 0.07, 0.07, g, g + 0.12, "marron");
    parte(L, cx, cy, d, 0.14 - sw, 0.07, 0.07, 0.07, g, g + 0.12, "marron");
    parte(L, cx, cy, d, -0.14 - sw, -0.07, 0.07, 0.07, g, g + 0.12, "marron");
    parte(L, cx, cy, d, -0.14 + sw, 0.07, 0.07, 0.07, g, g + 0.12, "marron");
    // cuerpo
    parte(L, cx, cy, d, -0.02, 0, 0.44, 0.22, g + 0.10, g + 0.30, "marron");
    // cabeza + hocico + nariz
    parte(L, cx, cy, d, 0.26, 0, 0.18, 0.18, g + 0.28 + zc, g + 0.46 + zc, "marron");
    parte(L, cx, cy, d, 0.38, 0, 0.06, 0.10, g + 0.30 + zc, g + 0.38 + zc, "crema");
    parte(L, cx, cy, d, 0.425, 0, 0.03, 0.05, g + 0.33 + zc, g + 0.37 + zc, "negro");
    // orejas: arriba si está bien, caídas si está triste
    if (e === "triste") {
      parte(L, cx, cy, d, 0.24, -0.105, 0.05, 0.03, g + 0.34 + zc, g + 0.44 + zc, "madera_oscura");
      parte(L, cx, cy, d, 0.24, 0.105, 0.05, 0.03, g + 0.34 + zc, g + 0.44 + zc, "madera_oscura");
    } else {
      parte(L, cx, cy, d, 0.23, -0.06, 0.05, 0.05, g + 0.46 + zc, g + 0.56 + zc, "madera_oscura");
      parte(L, cx, cy, d, 0.23, 0.06, 0.05, 0.05, g + 0.46 + zc, g + 0.56 + zc, "madera_oscura");
    }
    // ojos
    if (d === 0 || d === 1) {
      parte(L, cx, cy, d, 0.36, -0.055, 0.02, 0.035, g + 0.38 + zc, g + 0.42 + zc, "negro");
      parte(L, cx, cy, d, 0.36, 0.055, 0.02, 0.035, g + 0.38 + zc, g + 0.42 + zc, "negro");
    }
    // cola según estado
    var colaZ = e === "contento" ? [0.34, 0.50] : e === "normal" ? [0.30, 0.42] : [0.16, 0.28];
    parte(L, cx, cy, d, -0.26, 0, 0.05, 0.05, g + colaZ[0], g + colaZ[1], "marron");
    return L;
  }

  function partesGato(m, rt, t) {
    var L = [], cx = rt.x, cy = rt.y, d = rt.dir;
    var e = estadoDe(m);
    var g = 0;
    if (performance.now() < rt.saltoHasta) g = Math.abs(Math.sin(t * 10)) * 0.14;
    var sw = rt.objetivo ? Math.sin(t * 9) * 0.04 : 0;

    if (rt.pose === "descansa") {
      parte(L, cx, cy, d, 0, 0, 0.42, 0.24, 0, 0.14, "gris");
      parte(L, cx, cy, d, 0.24, 0, 0.16, 0.16, 0.03, 0.20, "gris");
      parte(L, cx, cy, d, 0.21, -0.05, 0.04, 0.03, 0.20, 0.27, "gris_oscuro");
      parte(L, cx, cy, d, 0.21, 0.05, 0.04, 0.03, 0.20, 0.27, "gris_oscuro");
      parte(L, cx, cy, d, -0.26, 0.08, 0.12, 0.04, 0, 0.04, "gris");
      return L;
    }

    var zc = e === "triste" ? -0.06 : 0;
    parte(L, cx, cy, d, 0.13 + sw, -0.06, 0.06, 0.06, g, g + 0.11, "gris");
    parte(L, cx, cy, d, 0.13 - sw, 0.06, 0.06, 0.06, g, g + 0.11, "gris");
    parte(L, cx, cy, d, -0.13 - sw, -0.06, 0.06, 0.06, g, g + 0.11, "gris");
    parte(L, cx, cy, d, -0.13 + sw, 0.06, 0.06, 0.06, g, g + 0.11, "gris");
    parte(L, cx, cy, d, -0.02, 0, 0.40, 0.18, g + 0.09, g + 0.26, "gris");
    parte(L, cx, cy, d, 0.14, 0, 0.10, 0.14, g + 0.09, g + 0.24, "blanco");   // pecho
    parte(L, cx, cy, d, 0.24, 0, 0.16, 0.16, g + 0.24 + zc, g + 0.40 + zc, "gris");
    parte(L, cx, cy, d, 0.33, 0, 0.03, 0.06, g + 0.26 + zc, g + 0.31 + zc, "rosa"); // naricilla
    // orejas puntiagudas
    parte(L, cx, cy, d, 0.21, -0.055, 0.04, 0.04, g + 0.40 + zc, g + 0.49 + zc, "gris_oscuro");
    parte(L, cx, cy, d, 0.21, 0.055, 0.04, 0.04, g + 0.40 + zc, g + 0.49 + zc, "gris_oscuro");
    if (d === 0 || d === 1) {
      parte(L, cx, cy, d, 0.325, -0.05, 0.02, 0.03, g + 0.33 + zc, g + 0.36 + zc, "verde_oscuro");
      parte(L, cx, cy, d, 0.325, 0.05, 0.02, 0.03, g + 0.33 + zc, g + 0.36 + zc, "verde_oscuro");
    }
    // cola: levantada y curvada si está bien; baja si triste
    if (e === "triste") {
      parte(L, cx, cy, d, -0.28, 0, 0.14, 0.04, g + 0.10, g + 0.15, "gris");
    } else {
      parte(L, cx, cy, d, -0.23, 0, 0.04, 0.04, g + 0.20, g + 0.44, "gris");
      parte(L, cx, cy, d, -0.20, 0, 0.04, 0.04, g + 0.44, g + 0.50, "gris_oscuro");
    }
    return L;
  }

  function dibujarSuelto(ctx, m, t) {
    var rt = runtime[m.uid];
    if (!rt) return;
    Iso.sombra(ctx, rt.x - 0.26, rt.y - 0.26, 0.52, 0.52);
    pintarPartes(ctx, m.tipo === "perro" ? partesPerro(m, rt, t) : partesGato(m, rt, t));
  }

  function cajaSuelto(m) {
    var rt = runtime[m.uid];
    if (!rt) return null;
    return { x0: rt.x - 0.32, y0: rt.y - 0.32, z0: 0, x1: rt.x + 0.32, y1: rt.y + 0.32, z1: 0.7 };
  }

  // --- peces y pájaros (dentro de su hogar) ---

  function cajitas(ctx, lista) {
    lista.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i];
      Iso.cubo(ctx, c.x, c.y, c.z, c.w, c.d, c.h, c.color);
    }
  }

  // transforma un punto local del furni según su rotación
  function puntoRot(lx, ly, rot, an, fo) {
    switch (rot) {
      case 1:  return { x: fo - ly, y: lx };
      case 2:  return { x: an - lx, y: fo - ly };
      case 3:  return { x: ly, y: an - lx };
      default: return { x: lx, y: ly };
    }
  }

  function dibujarPez(ctx, wx, wy, wz, eje, color, triste) {
    var lx = Math.abs(eje.dx) > 0;
    var s = lx ? eje.dx : eje.dy;
    var lista = [];
    var L = 0.17, W = 0.07, H = 0.09;
    var bx = lx ? L : W, by = lx ? W : L;
    lista.push({ x: wx - bx / 2, y: wy - by / 2, z: wz, w: bx, d: by, h: H, color: color });
    // cola detrás
    var tOff = -0.115 * s;
    var tx2 = wx + (lx ? tOff : 0), ty2 = wy + (lx ? 0 : tOff);
    lista.push({ x: tx2 - (lx ? 0.025 : 0.03), y: ty2 - (lx ? 0.03 : 0.025), z: wz + 0.015, w: lx ? 0.05 : 0.06, d: lx ? 0.06 : 0.05, h: 0.06, color: "blanco" });
    // ojo delante arriba
    var oOff = 0.075 * s;
    var ox = wx + (lx ? oOff : 0.028), oy = wy + (lx ? 0.028 : oOff);
    lista.push({ x: ox, y: oy, z: wz + H - 0.035, w: 0.022, d: 0.022, h: 0.025, color: "negro" });
    cajitas(ctx, lista);
    if (triste) return; // los tristes nadan sin burbujas
    // burbujita
    Iso.cubo(ctx, wx + (lx ? oOff * 1.6 : 0), wy + (lx ? 0 : oOff * 1.6), wz + 0.16, 0.03, 0.03, 0.03, "blanco");
  }

  function dibujarPajaro(ctx, wx, wy, wz, color, t, contento) {
    var hop = contento ? Math.abs(Math.sin(t * 6)) * 0.045 : 0;
    var z = wz + hop;
    var lista = [
      { x: wx - 0.115, y: wy - 0.02, z: z + 0.03, w: 0.05, d: 0.04, h: 0.03, color: "azul" },      // cola
      { x: wx - 0.07, y: wy - 0.05, z: z, w: 0.13, d: 0.10, h: 0.10, color: color },               // cuerpo
      { x: wx + 0.02, y: wy - 0.04, z: z + 0.07, w: 0.08, d: 0.08, h: 0.08, color: color },        // cabeza
      { x: wx + 0.10, y: wy - 0.017, z: z + 0.095, w: 0.035, d: 0.034, h: 0.03, color: "naranja" } // pico
    ];
    cajitas(ctx, lista);
  }

  // Dibuja los habitantes de un acuario o aviario del jardín.
  // Los del aviario se pintan ANTES del furni (quedan tras los
  // barrotes); los del acuario DESPUÉS (delante del cristal).
  function dibujarEnHogar(ctx, f, t) {
    var habs = habitantesDe(f.uid);
    if (!habs.length) return;
    var def = Furnis.get(f.id);
    if (f.id === "acuario") {
      habs.forEach(function (m, i) {
        var fase = t * 0.55 + i * 2.1;
        var u = 1 + Math.sin(fase) * 0.62;
        var signo = Math.cos(fase) >= 0 ? 1 : -1;
        var triste = estadoDe(m) === "triste";
        var zf = triste ? 0.52 : 0.60 + 0.08 * Math.sin(t * 0.9 + i);
        var p = puntoRot(u, 0.84, f.rot || 0, def.tam[0], def.tam[1]);
        var p2 = puntoRot(u + 0.1, 0.84, f.rot || 0, def.tam[0], def.tam[1]);
        var eje = { dx: Math.sign(Math.round((p2.x - p.x) * 10)) * signo, dy: Math.sign(Math.round((p2.y - p.y) * 10)) * signo };
        if (!eje.dx && !eje.dy) eje.dx = signo;
        dibujarPez(ctx, f.x + p.x, f.y + p.y, zf, eje, COLORES_PEZ[i % 3], triste);
      });
    } else if (f.id === "aviario") {
      habs.forEach(function (m, i) {
        var off = (i === 0) ? -0.17 : 0.17;
        dibujarPajaro(ctx, f.x + 0.5, f.y + 0.5 + off, 0.74, i ? "amarillo" : "turquesa",
          t + i * 1.7, estadoDe(m) === "contento");
      });
    }
  }

  // ---------------- interacción / utilidades ----------------

  function mascotaEn(tx, ty) {
    var lista = Juego.mascotas();
    for (var i = 0; i < lista.length; i++) {
      var m = lista[i];
      if (!TIPOS[m.tipo].libre) continue;
      var rt = runtime[m.uid];
      if (rt && Math.floor(rt.x) === tx && Math.floor(rt.y) === ty) return m;
    }
    return null;
  }

  function miniatura(canvas, tipo) {
    var ambientePrevio = Paleta.ambiente();
    Paleta.ponAmbiente("manana"); // miniaturas siempre con luz de día
    try {
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height * 0.62);
      var esc = Math.min(canvas.width / 105, canvas.height / 90) * 1.35;
      ctx.scale(esc, esc);
      Iso.plano(ctx, -0.55, -0.55, 0, 1.1, 1.1, "verde");
      Iso.sombra(ctx, -0.3, -0.3, 0.6, 0.6);
      var falsa = { uid: -1, tipo: tipo, felicidad: 80, hambre: 80, energia: 80 };
      var rt = { x: 0, y: 0, dir: 1, objetivo: null, pose: "normal", saltoHasta: 0 };
      if (tipo === "perro") pintarPartes(ctx, partesPerro(falsa, rt, 0));
      else if (tipo === "gato") pintarPartes(ctx, partesGato(falsa, rt, 0));
      else if (tipo === "pez") dibujarPez(ctx, 0, 0, 0.18, { dx: 0, dy: 1 }, "naranja", false);
      else dibujarPajaro(ctx, 0, 0, 0.06, "turquesa", 0, false);
      ctx.restore();
    } finally {
      Paleta.ponAmbiente(ambientePrevio);
    }
  }

  return {
    TIPOS: TIPOS,
    COMIDA: COMIDA,
    estadoDe: estadoDe,
    emojiEstado: emojiEstado,
    esLibre: function (tipo) { return !!TIPOS[tipo].libre; },
    puedeComprar: puedeComprar,
    comprar: comprar,
    alimentar: alimentar,
    jugar: jugar,
    tick: tick,
    felicidadGlobal: felicidadGlobal,
    habitantesDe: habitantesDe,
    mascotaEn: mascotaEn,
    runtimeDe: function (uid) { return runtime[uid] || null; },
    cajaSuelto: cajaSuelto,
    dibujarSuelto: dibujarSuelto,
    dibujarEnHogar: dibujarEnHogar,
    miniatura: miniatura,
    ponAlRecompensa: function (fn) { alRecompensa = fn; }
  };
})();
