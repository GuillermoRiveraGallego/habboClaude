"use strict";

// ============================================================
// SALA — motor de sala: render con orden de pintado correcto,
// rejilla de bloqueo, pathfinding A*, avatar (caminar, sentarse,
// tumbarse) y modo decoración: fantasma de colocación con
// validación, selección de furnis, alfombras y furnis de pared.
// ============================================================
var Sala = (function () {

  var GROSOR_PARED = 0.18;
  var ALTO_PARED = 2.4;
  var ALTO_SETO = 0.55;  // "pared" del jardín
  var VEL_AVATAR = 2.8;  // casillas por segundo

  function esJardin(s) { return !!(s && s.tipo === "jardin"); }

  function esBaile(s) { return !!(s && s.tipo === "baile"); }

  // pista central de la sala de baile (margen de 2 casillas)
  function enPista(s, tx, ty) {
    return esBaile(s) &&
      tx >= 2 && tx < s.ancho - 2 && ty >= 2 && ty < s.fondo - 2;
  }

  var COLORES_PISTA = ["rosa", "turquesa", "amarillo", "morado", "azul_claro", "verde"];

  function altoParedDe(s) { return esJardin(s) ? ALTO_SETO : ALTO_PARED; }

  var PARES_SUELO = {
    beige: "crema", crema: "blanco", gris: "blanco", blanco: "crema",
    azul_claro: "blanco", verde: "crema", rosa: "blanco", madera: "beige",
    turquesa: "azul_claro", amarillo: "crema", morado: "rosa"
  };

  var canvas = null, ctx = null, W = 0, H = 0;
  var escala = 1.15, trasX = 0, trasY = 0;

  var sala = null;
  var avatar = { x: 0, y: 0, dir: 1, pose: "parado", fase: 0, gz: 0, sentadoEn: null, casilla: null };
  var camino = [];
  var alLlegar = null;
  var hover = null;        // casilla de suelo bajo el ratón
  var hoverPared = null;   // {pared, slot} bajo el ratón (para fantasmas de pared)
  var marcas = [];
  var tUltimo = 0;
  var congelado = false;

  var tBaile = 0;              // acumulador del giro al bailar
  var modoActual = "pasear";   // "pasear" | "decorar"
  var fantasma = null;         // {id, rot, origen, uid}
  var seleccion = null;        // instancia seleccionada en modo decorar
  var cbs = {};                // callbacks de la UI

  // ---------------- utilidades ----------------

  function dentro(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < sala.ancho && ty < sala.fondo;
  }

  function pieDe(f) {
    return Furnis.pie(f.id, f.rot || 0);
  }

  function esPared(f) {
    return Furnis.get(f.id).capa === "pared";
  }

  function furniEn(tx, ty, capa) {
    capa = capa || "furni";
    for (var i = 0; i < sala.furnis.length; i++) {
      var f = sala.furnis[i];
      if (esPared(f) || Furnis.get(f.id).capa !== capa) continue;
      var p = pieDe(f);
      if (tx >= f.x && tx < f.x + p[0] && ty >= f.y && ty < f.y + p[1]) return f;
    }
    return null;
  }

  function furniPared(pared, slot) {
    for (var i = 0; i < sala.furnis.length; i++) {
      var f = sala.furnis[i];
      if (esPared(f) && f.pared === pared && f.slot === slot) return f;
    }
    return null;
  }

  function rejillaBloqueo() {
    var g = [], x, y;
    for (y = 0; y < sala.fondo; y++) {
      g.push([]);
      for (x = 0; x < sala.ancho; x++) g[y].push(false);
    }
    for (var i = 0; i < sala.furnis.length; i++) {
      var f = sala.furnis[i], def = Furnis.get(f.id);
      if (esPared(f) || def.capa !== "furni" || !def.bloquea) continue;
      var p = pieDe(f);
      for (y = f.y; y < f.y + p[1]; y++)
        for (x = f.x; x < f.x + p[0]; x++)
          if (dentro(x, y)) g[y][x] = true;
    }
    // los NPCs ocupan su casilla (no se puede caminar a través)
    if (window.Npcs) {
      Npcs.enSala(Juego.indiceSala()).forEach(function (n) {
        if (dentro(n.x, n.y)) g[n.y][n.x] = true;
      });
    }
    return g;
  }

  function distOctil(a, b) {
    var dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  }

  // ---------------- A* ----------------

  function aEstrella(bloq, ini, fin) {
    function libre(x, y) { return dentro(x, y) && !bloq[y][x]; }
    if (!libre(fin.x, fin.y)) return null;
    if (ini.x === fin.x && ini.y === fin.y) return [];

    function clave(x, y) { return x + "," + y; }
    function h(x, y) {
      var dx = Math.abs(x - fin.x), dy = Math.abs(y - fin.y);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    }

    var inicio = { x: ini.x, y: ini.y, g: 0, f: h(ini.x, ini.y), padre: null };
    var abierta = [inicio];
    var visto = {};
    visto[clave(ini.x, ini.y)] = inicio;

    while (abierta.length) {
      var mejor = 0;
      for (var i = 1; i < abierta.length; i++) if (abierta[i].f < abierta[mejor].f) mejor = i;
      var n = abierta.splice(mejor, 1)[0];
      if (visto[clave(n.x, n.y)] !== n) continue;

      if (n.x === fin.x && n.y === fin.y) {
        var ruta = [];
        while (n.padre) { ruta.unshift({ x: n.x, y: n.y }); n = n.padre; }
        return ruta;
      }

      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var nx = n.x + dx, ny = n.y + dy;
          if (!libre(nx, ny)) continue;
          if (dx && dy && (!libre(n.x + dx, n.y) || !libre(n.x, n.y + dy))) continue;
          var g2 = n.g + ((dx && dy) ? 1.414 : 1);
          var k = clave(nx, ny);
          if (visto[k] && visto[k].g <= g2) continue;
          var m = { x: nx, y: ny, g: g2, f: g2 + h(nx, ny), padre: n };
          visto[k] = m;
          abierta.push(m);
        }
      }
    }
    return null;
  }

  // ---------------- movimiento del avatar ----------------

  function casillaAvatar() {
    return { x: Math.floor(avatar.x), y: Math.floor(avatar.y) };
  }

  function vecinosLibres(tx, ty, bloq) {
    var v = [];
    for (var dy = -1; dy <= 1; dy++)
      for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = tx + dx, ny = ty + dy;
        if (dentro(nx, ny) && !bloq[ny][nx]) v.push({ x: nx, y: ny });
      }
    return v;
  }

  function levantarse(bloq, hacia) {
    var vecinos = vecinosLibres(avatar.casilla.x, avatar.casilla.y, bloq);
    if (!vecinos.length) return false;
    vecinos.sort(function (a, b) { return distOctil(a, hacia) - distOctil(b, hacia); });
    var o = vecinos[0];
    avatar.x = o.x + 0.5;
    avatar.y = o.y + 0.5;
    avatar.sentadoEn = null;
    avatar.casilla = null;
    avatar.gz = 0;
    avatar.pose = "parado";
    return true;
  }

  // Si el avatar está sentado en el furni con ese uid, lo pone
  // de pie en el sitio (para mover/vender el mueble).
  function levantarSiSentadoEn(uid) {
    if (avatar.sentadoEn && avatar.sentadoEn.uid === uid) {
      avatar.x = avatar.casilla.x + 0.5;
      avatar.y = avatar.casilla.y + 0.5;
      avatar.sentadoEn = null;
      avatar.casilla = null;
      avatar.gz = 0;
      avatar.pose = "parado";
    }
  }

  function iniciarCamino(destino, cb) {
    var bloq = rejillaBloqueo();
    if (avatar.sentadoEn && !levantarse(bloq, destino)) return false;
    var ruta = aEstrella(bloq, casillaAvatar(), destino);
    if (!ruta) return false;
    camino = ruta.map(function (t) { return { x: t.x + 0.5, y: t.y + 0.5 }; });
    alLlegar = cb || null;
    if (camino.length) {
      avatar.pose = "andando";
    } else if (cb) {
      alLlegar = null;
      cb();
    }
    return true;
  }

  function colocarSentado(f, def, tx, ty) {
    avatar.sentadoEn = f;
    avatar.casilla = { x: tx, y: ty };
    avatar.dir = f.rot || 0;
    avatar.gz = def.alturaAsiento || 0.5;
    avatar.fase = 0;
    if (def.sentable === "tumbado") {
      avatar.pose = "tumbado";
      var p = pieDe(f);
      avatar.x = f.x + p[0] / 2;
      avatar.y = f.y + p[1] / 2;
    } else {
      avatar.pose = "sentado";
      avatar.x = tx + 0.5;
      avatar.y = ty + 0.5;
    }
  }

  // Camina hasta una casilla vecina de (tx, ty) y ejecuta cb al llegar
  function acercarseA(tx, ty, cb) {
    var bloq = rejillaBloqueo();
    var vecinos = vecinosLibres(tx, ty, bloq);
    if (!vecinos.length) { marcar(tx, ty, "rojo"); return; }
    var pa = casillaAvatar();
    vecinos.sort(function (a, b) { return distOctil(a, pa) - distOctil(b, pa); });
    for (var i = 0; i < vecinos.length; i++) {
      if (iniciarCamino(vecinos[i], cb)) { marcar(tx, ty, "amarillo"); return; }
    }
    marcar(tx, ty, "rojo");
  }

  function sentarseEn(f, tx, ty) {
    var def = Furnis.get(f.id);
    acercarseA(tx, ty, function () { colocarSentado(f, def, tx, ty); });
  }

  function marcar(tx, ty, color) {
    marcas.push({ x: tx, y: ty, hasta: performance.now() + 700, color: color });
  }

  function actualizar(dt) {
    if (congelado) return;
    // mascotas: sus estadísticas avanzan siempre; solo se
    // mueven si el jardín es la sala cargada
    if (window.Mascotas && sala) {
      var ctxJardin = null;
      if (esJardin(sala)) {
        var bloqJ = rejillaBloqueo();
        ctxJardin = {
          ancho: sala.ancho,
          fondo: sala.fondo,
          libre: function (x, y) { return dentro(x, y) && !bloqJ[y][x]; }
        };
      }
      Mascotas.tick(dt, ctxJardin);
    }
    if (!camino.length) {
      if (avatar.pose === "andando") { avatar.pose = "parado"; avatar.fase = 0; }
      // habilidad desbloqueable: bailar quieto sobre la pista
      if (!avatar.sentadoEn && Juego.recompensas().bailar &&
          enPista(sala, Math.floor(avatar.x), Math.floor(avatar.y))) {
        avatar.pose = "bailando";
        avatar.fase += dt * 9;
        tBaile += dt;
        if (tBaile > 0.9) { tBaile = 0; avatar.dir = (avatar.dir + 1) % 4; }
      } else if (avatar.pose === "bailando") {
        avatar.pose = "parado";
        avatar.fase = 0;
      }
      return;
    }
    avatar.fase += dt * 11;
    var obj = camino[0];
    var dx = obj.x - avatar.x, dy = obj.y - avatar.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(dx) > Math.abs(dy) + 0.001) avatar.dir = dx > 0 ? 0 : 2;
    else if (Math.abs(dy) > 0.001) avatar.dir = dy > 0 ? 1 : 3;
    var paso = VEL_AVATAR * dt;
    if (paso >= dist) {
      avatar.x = obj.x;
      avatar.y = obj.y;
      camino.shift();
      if (!camino.length) {
        avatar.pose = "parado";
        avatar.fase = 0;
        if (alLlegar) { var cb = alLlegar; alLlegar = null; cb(); }
      }
    } else {
      avatar.x += dx / dist * paso;
      avatar.y += dy / dist * paso;
      avatar.pose = "andando";
    }
  }

  // ---------------- validación de colocación ----------------

  function validar(id, x, y, rot, uidIgnorar) {
    var def = Furnis.get(id);
    if (!def) return false;
    var p = Furnis.pie(id, rot || 0);
    if (x < 0 || y < 0 || x + p[0] > sala.ancho || y + p[1] > sala.fondo) return false;

    for (var i = 0; i < sala.furnis.length; i++) {
      var g = sala.furnis[i];
      if (esPared(g) || g.uid === uidIgnorar) continue;
      if (Furnis.get(g.id).capa !== def.capa) continue; // capas distintas conviven
      var q = pieDe(g);
      if (x < g.x + q[0] && x + p[0] > g.x && y < g.y + q[1] && y + p[1] > g.y) return false;
    }

    // no colocar furnis que bloquean encima del avatar
    if (def.capa === "furni" && def.bloquea) {
      var ca = avatar.sentadoEn ? avatar.casilla : casillaAvatar();
      if (ca.x >= x && ca.x < x + p[0] && ca.y >= y && ca.y < y + p[1]) return false;
    }
    // ni encima de un NPC
    if (def.capa === "furni" && window.Npcs) {
      var ns = Npcs.enSala(Juego.indiceSala());
      for (var j = 0; j < ns.length; j++) {
        if (ns[j].x >= x && ns[j].x < x + p[0] && ns[j].y >= y && ns[j].y < y + p[1]) return false;
      }
    }
    return true;
  }

  function validarPared(id, pared, slot, uidIgnorar) {
    if (esJardin(sala)) return false; // los setos no sujetan cuadros
    var len = (pared === "x") ? sala.ancho : sala.fondo;
    if (slot < 0 || slot >= len) return false;
    var f = furniPared(pared, slot);
    return !f || f.uid === uidIgnorar;
  }

  // ---------------- interacción ----------------

  function manejarClickPasear(tx, ty) {
    if (!dentro(tx, ty)) return;
    // NPCs: click → acercarse y abrir el chat
    if (window.Npcs) {
      var npc = Npcs.npcEn(tx, ty, Juego.indiceSala());
      if (npc) {
        if (cbs.alNpc) {
          acercarseA(tx, ty, function () { cbs.alNpc(npc); });
        }
        return;
      }
    }
    // mascotas del jardín: click → panel de la mascota
    if (esJardin(sala) && window.Mascotas) {
      var m = Mascotas.mascotaEn(tx, ty);
      if (m && cbs.alMascota) {
        var rt = Mascotas.runtimeDe(m.uid);
        cbs.alMascota(m, puntoPantalla(rt.x, rt.y, 0.9));
        return;
      }
    }
    var f = furniEn(tx, ty);
    if (f) {
      // acuario/aviario habitado: abrir el panel de sus mascotas
      if (esJardin(sala) && window.Mascotas &&
          (f.id === "acuario" || f.id === "aviario")) {
        var habs = Mascotas.habitantesDe(f.uid);
        if (habs.length && cbs.alMascota) {
          cbs.alMascota(habs[0], puntoDe(f));
          return;
        }
      }
      // el ordenador de casa: acercarse y abrir los minijuegos
      if (f.fijo && f.id === "escritorio_ordenador") {
        var pa = avatar.sentadoEn ? avatar.casilla : casillaAvatar();
        var pf = pieDe(f);
        var dx = Math.max(f.x - pa.x, 0, pa.x - (f.x + pf[0] - 1));
        var dy = Math.max(f.y - pa.y, 0, pa.y - (f.y + pf[1] - 1));
        if (Math.max(dx, dy) <= 1 && !avatar.sentadoEn) {
          if (cbs.alOrdenador) cbs.alOrdenador(f); // ya está al lado
        } else {
          acercarseA(tx, ty, function () {
            if (cbs.alOrdenador) cbs.alOrdenador(f);
          });
        }
        return;
      }
      var def = Furnis.get(f.id);
      if (def.sentable && f !== avatar.sentadoEn) sentarseEn(f, tx, ty);
      else if (!def.sentable) marcar(tx, ty, "rojo");
      return;
    }
    var ok = iniciarCamino({ x: tx, y: ty });
    marcar(tx, ty, ok ? "amarillo" : "rojo");
  }

  function manejarClickDecorar(tx, ty, pared) {
    // 1) con fantasma: intentar colocar
    if (fantasma) {
      var def = Furnis.get(fantasma.id);
      if (def.capa === "pared") {
        if (pared && validarPared(fantasma.id, pared.pared, pared.slot, fantasma.uid)) {
          if (cbs.alColocar) cbs.alColocar({
            id: fantasma.id, origen: fantasma.origen, uid: fantasma.uid,
            pared: pared.pared, slot: pared.slot
          });
        }
      } else if (hover && validar(fantasma.id, hover.x, hover.y, fantasma.rot, fantasma.uid)) {
        if (cbs.alColocar) cbs.alColocar({
          id: fantasma.id, origen: fantasma.origen, uid: fantasma.uid,
          x: hover.x, y: hover.y, rot: fantasma.rot
        });
      } else if (hover) {
        marcar(hover.x, hover.y, "rojo");
      }
      return;
    }
    // 2) sin fantasma: seleccionar furni
    var f = null;
    if (pared) f = furniPared(pared.pared, pared.slot);
    if (!f && dentro(tx, ty)) {
      f = furniEn(tx, ty) || furniEn(tx, ty, "alfombra");
    }
    seleccion = f || null;
    if (cbs.alSeleccionar) cbs.alSeleccionar(seleccion, seleccion ? puntoDe(seleccion) : null);
  }

  // mundo → px CSS sobre el canvas (para posicionar paneles de la UI)
  function puntoPantalla(x, y, z) {
    var p = Iso.proyectar(x, y, z || 0);
    return { x: p.x * escala + trasX, y: p.y * escala + trasY };
  }

  // punto de pantalla (px CSS sobre el canvas) de un furni, para la UI
  function puntoDe(f) {
    var p;
    if (esPared(f)) {
      var u = f.slot + 0.5;
      p = (f.pared === "x") ? Iso.proyectar(u, 0, 1.9) : Iso.proyectar(0, u, 1.9);
    } else {
      var q = pieDe(f);
      p = Iso.proyectar(f.x + q[0] / 2, f.y + q[1] / 2, Furnis.get(f.id).altura + 0.2);
    }
    return { x: p.x * escala + trasX, y: p.y * escala + trasY };
  }

  // ---------------- dibujo ----------------

  function casillaMarcada(tx, ty, color, rellenar) {
    var a = Iso.proyectar(tx, ty, 0.002),
        b = Iso.proyectar(tx + 1, ty, 0.002),
        c = Iso.proyectar(tx + 1, ty + 1, 0.002),
        d = Iso.proyectar(tx, ty + 1, 0.002);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    if (rellenar) { ctx.fillStyle = color; ctx.fill(); }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function contornoPie(x, y, w, d, color) {
    var a = Iso.proyectar(x, y, 0.004),
        b = Iso.proyectar(x + w, y, 0.004),
        c = Iso.proyectar(x + w, y + d, 0.004),
        e = Iso.proyectar(x, y + d, 0.004);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function marcoPared(pared, slot, color) {
    var z0 = 0.95, z1 = 1.95;
    var a, b, c, d;
    if (pared === "x") {
      a = Iso.proyectar(slot, 0, z1); b = Iso.proyectar(slot + 1, 0, z1);
      c = Iso.proyectar(slot + 1, 0, z0); d = Iso.proyectar(slot, 0, z0);
    } else {
      a = Iso.proyectar(0, slot, z1); b = Iso.proyectar(0, slot + 1, z1);
      c = Iso.proyectar(0, slot + 1, z0); d = Iso.proyectar(0, slot, z0);
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function dibujar() {
    if (!sala) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(trasX, trasY);
    ctx.scale(escala, escala);

    var A = sala.ancho, F = sala.fondo, G = GROSOR_PARED;
    var jardin = esJardin(sala);
    var ahoraSeg = performance.now() / 1000;

    // paredes (o setos), suelo y furnis de pared
    var altoP = altoParedDe(sala);
    var colorP = jardin ? "verde_oscuro" : sala.colorPared;
    Iso.cubo(ctx, -G, -G, 0, G, F + G, altoP, colorP);
    Iso.cubo(ctx, 0, -G, 0, A, G, altoP, colorP);
    if (!jardin) {
      sala.furnis.forEach(function (f) {
        if (esPared(f)) Furnis.get(f.id).dibujarPared(ctx, f.pared, f.slot);
      });
    }
    Iso.cubo(ctx, 0, 0, -0.22, A, F, 0.22, jardin ? "marron" : sala.colorSuelo);
    if (jardin) {
      for (var gy = 0; gy < F; gy++)
        for (var gx = 0; gx < A; gx++)
          Iso.plano(ctx, gx, gy, 0, 1, 1, "verde"); // césped
    } else if (esBaile(sala)) {
      // pista central: los colores rotan en oleada diagonal
      var pasoPista = Math.floor(ahoraSeg * 1.6);
      var parB = PARES_SUELO[sala.colorSuelo] || sala.colorSuelo;
      for (var by = 0; by < F; by++)
        for (var bx = 0; bx < A; bx++) {
          if (enPista(sala, bx, by)) {
            Iso.plano(ctx, bx, by, 0, 1, 1,
              COLORES_PISTA[(bx * 2 + by * 3 + pasoPista) % COLORES_PISTA.length]);
            // destello suave que recorre la pista
            if ((bx + by + pasoPista) % 5 === 0) {
              casillaMarcada(bx, by, "rgba(255, 255, 255, 0.16)", true);
            }
          } else {
            Iso.plano(ctx, bx, by, 0, 1, 1, ((bx + by) % 2) ? parB : sala.colorSuelo);
          }
        }
    } else {
      var par = PARES_SUELO[sala.colorSuelo] || sala.colorSuelo;
      for (var ty = 0; ty < F; ty++)
        for (var tx = 0; tx < A; tx++)
          Iso.plano(ctx, tx, ty, 0, 1, 1, ((tx + ty) % 2) ? par : sala.colorSuelo);
    }

    // alfombras (capa entre suelo y furnis)
    sala.furnis.forEach(function (f) {
      if (!esPared(f) && Furnis.get(f.id).capa === "alfombra") {
        Furnis.dibujar(ctx, f.id, f.x, f.y, f.rot || 0);
      }
    });

    // resaltado de casilla
    if (hover && dentro(hover.x, hover.y) && !fantasma) {
      casillaMarcada(hover.x, hover.y, "rgba(255,255,255,0.35)", false);
    }

    // señales de click
    var ahora = performance.now();
    marcas = marcas.filter(function (m) { return m.hasta > ahora; });
    for (var i = 0; i < marcas.length; i++) {
      var m = marcas[i], alfa = (m.hasta - ahora) / 700;
      casillaMarcada(m.x, m.y,
        m.color === "rojo"
          ? "rgba(201, 83, 73, " + (0.55 * alfa).toFixed(3) + ")"
          : "rgba(228, 194, 90, " + (0.55 * alfa).toFixed(3) + ")",
        true);
    }

    // furnis de suelo + avatar con orden de pintado global
    var cajas = [];
    var halos = [];
    var lucesOn = window.Ambiente && Ambiente.lucesEncendidas();
    sala.furnis.forEach(function (f) {
      if (esPared(f) || Furnis.get(f.id).capa === "alfombra") return;
      var def = Furnis.get(f.id);
      var p = pieDe(f);
      // fuentes de luz encendidas (noche y atardecer)
      if (lucesOn && def.luz) {
        var pl = Furnis.puntoRotado(f.id, f.rot || 0, def.luz.x, def.luz.y);
        halos.push({
          x: f.x + pl.x, y: f.y + pl.y, z: def.luz.z,
          radio: def.luz.radio, color: def.luz.color
        });
      }
      var sentadoAqui = (avatar.sentadoEn === f);
      var caja = {
        x0: f.x, y0: f.y, z0: 0,
        x1: f.x + p[0], y1: f.y + p[1],
        z1: def.altura + (sentadoAqui ? 1.2 : 0)
      };
      // hogares de mascotas: pájaros tras los barrotes (antes),
      // peces delante del cristal (después)
      var esHogar = jardin && window.Mascotas && (f.id === "acuario" || f.id === "aviario");
      caja.dibuja = function () {
        Iso.sombra(ctx, f.x, f.y, p[0], p[1]);
        if (esHogar && f.id === "aviario") Mascotas.dibujarEnHogar(ctx, f, ahoraSeg);
        if (sentadoAqui && (f.rot === 2 || f.rot === 3)) {
          Avatar.dibujar(ctx, avatar);
          Furnis.dibujar(ctx, f.id, f.x, f.y, f.rot || 0);
        } else {
          Furnis.dibujar(ctx, f.id, f.x, f.y, f.rot || 0);
          if (sentadoAqui) Avatar.dibujar(ctx, avatar);
        }
        if (esHogar && f.id === "acuario") Mascotas.dibujarEnHogar(ctx, f, ahoraSeg);
      };
      cajas.push(caja);
    });
    if (!avatar.sentadoEn) {
      var ca = Avatar.caja(avatar);
      ca.dibuja = function () { Avatar.dibujar(ctx, avatar); };
      cajas.push(ca);
    }
    // mascotas sueltas del jardín (perros y gatos)
    if (jardin && window.Mascotas) {
      Juego.mascotas().forEach(function (m) {
        if (!Mascotas.esLibre(m.tipo)) return;
        var cm = Mascotas.cajaSuelto(m);
        if (!cm) return;
        cm.dibuja = function () { Mascotas.dibujarSuelto(ctx, m, ahoraSeg); };
        cajas.push(cm);
      });
    }
    // NPCs de la sala
    if (window.Npcs) {
      Npcs.enSala(Juego.indiceSala()).forEach(function (npc) {
        var cn = Npcs.caja(npc);
        cn.dibuja = function () { Npcs.dibujar(ctx, npc, ahoraSeg); };
        cajas.push(cn);
      });
    }
    var ordenadas = Iso.ordenarCajas(cajas);
    for (var j = 0; j < ordenadas.length; j++) ordenadas[j].dibuja();

    // halos de luz (lámparas, pantallas y fuego)
    if (halos.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var hI = 0; hI < halos.length; hI++) {
        var h = halos[hI];
        var ph = Iso.proyectar(h.x, h.y, h.z);
        var grad = ctx.createRadialGradient(ph.x, ph.y, 2, ph.x, ph.y, h.radio);
        var cRGB = h.color[0] + "," + h.color[1] + "," + h.color[2];
        grad.addColorStop(0, "rgba(" + cRGB + ",0.5)");
        grad.addColorStop(0.45, "rgba(" + cRGB + ",0.18)");
        grad.addColorStop(1, "rgba(" + cRGB + ",0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ph.x, ph.y, h.radio, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // selección (modo decorar)
    if (seleccion && modoActual === "decorar") {
      var pulso = 0.5 + 0.3 * Math.sin(ahora / 180);
      if (esPared(seleccion)) {
        marcoPared(seleccion.pared, seleccion.slot, "rgba(228,194,90," + pulso.toFixed(3) + ")");
      } else {
        var ps = pieDe(seleccion);
        contornoPie(seleccion.x, seleccion.y, ps[0], ps[1], "rgba(228,194,90," + pulso.toFixed(3) + ")");
      }
    }

    // fantasma de colocación
    if (fantasma) {
      var defF = Furnis.get(fantasma.id);
      if (defF.capa === "pared") {
        if (hoverPared) {
          var okP = validarPared(fantasma.id, hoverPared.pared, hoverPared.slot, fantasma.uid);
          marcoPared(hoverPared.pared, hoverPared.slot,
            okP ? "rgba(127,174,92,0.9)" : "rgba(201,83,73,0.9)");
          ctx.globalAlpha = 0.6;
          defF.dibujarPared(ctx, hoverPared.pared, hoverPared.slot);
          ctx.globalAlpha = 1;
        }
      } else if (hover) {
        var ok2 = validar(fantasma.id, hover.x, hover.y, fantasma.rot, fantasma.uid);
        var pf = Furnis.pie(fantasma.id, fantasma.rot);
        for (var fy = hover.y; fy < hover.y + pf[1]; fy++)
          for (var fx = hover.x; fx < hover.x + pf[0]; fx++)
            casillaMarcada(fx, fy,
              ok2 ? "rgba(127,174,92,0.45)" : "rgba(201,83,73,0.45)", true);
        ctx.globalAlpha = 0.6;
        Furnis.dibujar(ctx, fantasma.id, hover.x, hover.y, fantasma.rot);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  function bucle(t) {
    var dt = Math.min(0.05, (t - tUltimo) / 1000 || 0.016);
    tUltimo = t;
    actualizar(dt);
    dibujar();
    requestAnimationFrame(bucle);
  }

  // ---------------- eventos ----------------

  function mundoDeEvento(e) {
    var r = canvas.getBoundingClientRect();
    return {
      sx: (e.clientX - r.left - trasX) / escala,
      sy: (e.clientY - r.top - trasY) / escala
    };
  }

  function casillaDe(sx, sy) {
    var x = (sx / Iso.MX + sy / Iso.MY) / 2;
    var y = (sy / Iso.MY - sx / Iso.MX) / 2;
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  function paredDe(sx, sy) {
    if (esJardin(sala)) return null; // el jardín no tiene paredes útiles
    // pared "x" (y = 0): u = sx/MX, z = (u*MY − sy)/MZ
    var u = sx / Iso.MX;
    var z = (u * Iso.MY - sy) / Iso.MZ;
    if (u >= 0 && u < sala.ancho && z >= 0.4 && z <= ALTO_PARED) {
      return { pared: "x", slot: Math.floor(u) };
    }
    // pared "y" (x = 0): u = −sx/MX
    u = -sx / Iso.MX;
    z = (u * Iso.MY - sy) / Iso.MZ;
    if (u >= 0 && u < sala.fondo && z >= 0.4 && z <= ALTO_PARED) {
      return { pared: "y", slot: Math.floor(u) };
    }
    return null;
  }

  function alClick(e) {
    if (!sala) return;
    var m = mundoDeEvento(e);
    var c = casillaDe(m.sx, m.sy);
    // en pantalla táctil no hubo mousemove previo: refrescar aquí
    hover = dentro(c.x, c.y) ? c : null;
    hoverPared = paredDe(m.sx, m.sy);
    if (modoActual === "pasear") manejarClickPasear(c.x, c.y);
    else manejarClickDecorar(c.x, c.y, hoverPared);
  }

  function alMover(e) {
    if (!sala) return;
    var m = mundoDeEvento(e);
    var c = casillaDe(m.sx, m.sy);
    hover = dentro(c.x, c.y) ? c : null;
    hoverPared = paredDe(m.sx, m.sy);
    canvas.style.cursor = (hover || hoverPared) ? "pointer" : "default";
  }

  function alTecla(e) {
    // no interceptar teclas mientras se escribe (chat, minijuegos)
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (modoActual !== "decorar") return;
    if (e.key === "r" || e.key === "R") {
      if (fantasma) rotarFantasma();
      else if (seleccion && cbs.alRotar) cbs.alRotar(seleccion);
    } else if (e.key === "Escape") {
      if (fantasma && cbs.alCancelarFantasma) cbs.alCancelarFantasma();
      seleccion = null;
      if (cbs.alSeleccionar) cbs.alSeleccionar(null, null);
    }
  }

  // ---------------- API ----------------

  // encuadre según el tamaño de la sala y del lienzo
  function encuadrar() {
    if (!sala) return;
    var altoP = altoParedDe(sala);
    var anchoPx = (sala.ancho + sala.fondo) * Iso.MX + 60;
    var altoPx = (sala.ancho + sala.fondo) * Iso.MY + altoP * Iso.MZ + 60;
    escala = Math.min(1.25, W / anchoPx, H / altoPx);
    var cxMundo = (sala.ancho - sala.fondo) / 2 * Iso.MX;
    var syTop = -altoP * Iso.MZ - GROSOR_PARED * 2 * Iso.MY;
    var syBot = (sala.ancho + sala.fondo) * Iso.MY + 0.22 * Iso.MZ;
    trasX = W / 2 - escala * cxMundo;
    trasY = H / 2 - escala * (syTop + syBot) / 2;
  }

  function ponerTamano(ancho, alto) {
    W = ancho;
    H = alto;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // adapta el lienzo a un tamaño nuevo (ventana redimensionada)
  // y recalcula el encuadre de la sala cargada
  function redimensionar(ancho, alto) {
    ponerTamano(ancho, alto);
    encuadrar();
  }

  function iniciar(el, opciones) {
    opciones = opciones || {};
    canvas = el;
    ctx = canvas.getContext("2d");
    ponerTamano(opciones.ancho || 1000, opciones.alto || 620);

    canvas.addEventListener("click", alClick);
    canvas.addEventListener("mousemove", alMover);
    canvas.addEventListener("mouseleave", function () { hover = null; hoverPared = null; });
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      if (fantasma && cbs.alCancelarFantasma) cbs.alCancelarFantasma();
    });
    window.addEventListener("keydown", alTecla);

    requestAnimationFrame(bucle);
  }

  function cargar(datosSala) {
    sala = datosSala;
    camino = [];
    alLlegar = null;
    fantasma = null;
    seleccion = null;
    avatar.sentadoEn = null;
    avatar.casilla = null;
    avatar.gz = 0;
    avatar.pose = "parado";

    encuadrar();

    // avatar en una casilla libre cercana al centro
    var bloq = rejillaBloqueo();
    var mejor = null, mejorD = Infinity;
    var cx = sala.ancho / 2, cy = sala.fondo / 2;
    for (var y = 0; y < sala.fondo; y++)
      for (var x = 0; x < sala.ancho; x++)
        if (!bloq[y][x]) {
          var d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d < mejorD) { mejorD = d; mejor = { x: x, y: y }; }
        }
    avatar.x = (mejor ? mejor.x : 0) + 0.5;
    avatar.y = (mejor ? mejor.y : 0) + 0.5;
  }

  function modo(m) {
    if (m === undefined) return modoActual;
    modoActual = m;
    seleccion = null;
    if (cbs.alSeleccionar) cbs.alSeleccionar(null, null);
    return modoActual;
  }

  function iniciarFantasma(id, rot, datos) {
    datos = datos || {};
    fantasma = { id: id, rot: rot || 0, origen: datos.origen || "catalogo", uid: datos.uid };
    seleccion = null;
    if (cbs.alSeleccionar) cbs.alSeleccionar(null, null);
  }

  function cancelarFantasma() { fantasma = null; }

  function rotarFantasma() {
    if (!fantasma) return;
    var def = Furnis.get(fantasma.id);
    fantasma.rot = (fantasma.rot + 1) % def.rotaciones;
  }

  var depurar = {
    sentar: function (uid) {
      for (var i = 0; i < sala.furnis.length; i++) {
        if (sala.furnis[i].uid === uid) {
          var f = sala.furnis[i];
          colocarSentado(f, Furnis.get(f.id), f.x, f.y);
          return;
        }
      }
    },
    avatar: function (props) {
      Object.keys(props).forEach(function (k) { avatar[k] = props[k]; });
      congelado = true;
    },
    click: function (tx, ty) {
      if (modoActual === "pasear") manejarClickPasear(tx, ty);
      else manejarClickDecorar(tx, ty, null);
    },
    hover: function (tx, ty) { hover = { x: tx, y: ty }; },
    hoverPared: function (pared, slot) { hoverPared = { pared: pared, slot: slot }; },
    seleccionar: function (uid) {
      for (var i = 0; i < sala.furnis.length; i++) {
        if (sala.furnis[i].uid === uid) {
          seleccion = sala.furnis[i];
          if (cbs.alSeleccionar) cbs.alSeleccionar(seleccion, puntoDe(seleccion));
          return;
        }
      }
    }
  };

  return {
    iniciar: iniciar,
    redimensionar: redimensionar,
    cargar: cargar,
    modo: modo,
    enlazar: function (callbacks) { cbs = callbacks || {}; },
    iniciarFantasma: iniciarFantasma,
    cancelarFantasma: cancelarFantasma,
    rotarFantasma: rotarFantasma,
    hayFantasma: function () { return !!fantasma; },
    fantasmaActual: function () { return fantasma; },
    seleccionado: function () { return seleccion; },
    deseleccionar: function () {
      seleccion = null;
      if (cbs.alSeleccionar) cbs.alSeleccionar(null, null);
    },
    validar: validar,
    validarPared: validarPared,
    levantarSiSentadoEn: levantarSiSentadoEn,
    puntoDe: puntoDe,
    puntoPantalla: puntoPantalla,
    depurar: depurar
  };
})();
