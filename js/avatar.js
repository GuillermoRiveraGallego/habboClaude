"use strict";

// ============================================================
// AVATAR — personaje voxel construido con los cubos de Iso,
// por lo que hereda la luz global automáticamente.
//
// Estado del avatar: { x, y (centro, coords de casilla
// continuas), dir (0=+x, 1=+y, 2=−x, 3=−y), pose ("parado" |
// "andando" | "sentado" | "tumbado"), fase (ciclo de andar),
// gz (altura base: 0 en el suelo, altura del asiento sentado) }
//
// PERSONALIZACIÓN (idea 6): el aspecto — peinado y colores de
// pelo, piel, camiseta, pantalones y zapatos — se define con
// ponAspecto(). El objeto vive en Juego.estado().avatar, así
// que queda listo para el guardado; aquí solo se lee.
//
// Las piezas se colocan en un marco local: `a` = avance en la
// dirección de la mirada, `b` = desplazamiento lateral.
// ============================================================
var Avatar = (function () {

  var DIRS = [
    { fx: 1, fy: 0 },
    { fx: 0, fy: 1 },
    { fx: -1, fy: 0 },
    { fx: 0, fy: -1 }
  ];

  // aspecto por defecto (lo sustituye el de Juego al arrancar)
  var aspecto = {
    peinado: "clasico",
    pelo: "madera_oscura",
    piel: "piel",
    camiseta: "turquesa",
    pantalon: "gris_oscuro",
    zapatos: "negro"
  };

  function ponAspecto(a) {
    if (a) aspecto = a;
  }

  var PEINADOS = [
    ["clasico", "Clásico"],
    ["tupe", "Tupé"],
    ["melena", "Melena"],
    ["coleta", "Coleta"],
    ["rapado", "Rapado"],
    ["calvo", "Calvo"]
  ];

  // Añade un cubo definido en el marco local del avatar
  function parte(L, cx, cy, dir, a, b, df, ds, z0, z1, color) {
    var D = DIRS[dir], sx = -D.fy, sy = D.fx;
    var ox = cx + D.fx * a + sx * b;
    var oy = cy + D.fy * a + sy * b;
    var tx = Math.abs(D.fx) * df + Math.abs(sx) * ds;
    var ty = Math.abs(D.fy) * df + Math.abs(sy) * ds;
    L.push({ x0: ox - tx / 2, y0: oy - ty / 2, z0: z0, x1: ox + tx / 2, y1: oy + ty / 2, z1: z1, color: color });
  }

  // Peinado sobre una cabeza cuyo centro avanza aH y cuya base
  // está en zB (la cabeza mide 0.30×0.30 y 0.28 de alto).
  function pelo(L, cx, cy, d, aH, zB) {
    var c = aspecto.pelo;
    switch (aspecto.peinado) {
      case "calvo":
        return;
      case "rapado":
        parte(L, cx, cy, d, aH - 0.01, 0, 0.32, 0.32, zB + 0.24, zB + 0.32, c);
        return;
      case "tupe":
        parte(L, cx, cy, d, aH - 0.03, 0, 0.32, 0.34, zB + 0.24, zB + 0.40, c);
        parte(L, cx, cy, d, aH + 0.10, 0, 0.14, 0.26, zB + 0.28, zB + 0.52, c); // tupé
        parte(L, cx, cy, d, aH - 0.14, 0, 0.06, 0.32, zB + 0.02, zB + 0.28, c); // nuca
        return;
      case "melena":
        parte(L, cx, cy, d, aH - 0.02, 0, 0.34, 0.34, zB + 0.24, zB + 0.38, c);
        parte(L, cx, cy, d, aH - 0.04, -0.175, 0.30, 0.05, zB - 0.08, zB + 0.30, c); // lado
        parte(L, cx, cy, d, aH - 0.04, 0.175, 0.30, 0.05, zB - 0.08, zB + 0.30, c);  // lado
        parte(L, cx, cy, d, aH - 0.17, 0, 0.07, 0.36, zB - 0.14, zB + 0.30, c);      // espalda
        return;
      case "coleta":
        parte(L, cx, cy, d, aH - 0.02, 0, 0.34, 0.34, zB + 0.24, zB + 0.38, c);
        parte(L, cx, cy, d, aH - 0.14, 0, 0.06, 0.32, zB + 0.02, zB + 0.28, c);
        parte(L, cx, cy, d, aH - 0.215, 0, 0.08, 0.10, zB - 0.04, zB + 0.24, c);     // coleta
        return;
      default: // clásico
        parte(L, cx, cy, d, aH - 0.02, 0, 0.34, 0.34, zB + 0.24, zB + 0.38, c);
        parte(L, cx, cy, d, aH - 0.14, 0, 0.06, 0.32, zB + 0.02, zB + 0.28, c);
    }
  }

  function partesDe(av) {
    var L = [], cx = av.x, cy = av.y, d = av.dir || 0, g = av.gz || 0;

    if (av.pose === "tumbado") {
      // cuerpo horizontal: la cabeza queda hacia -dir (almohada)
      if (aspecto.peinado !== "calvo") {
        parte(L, cx, cy, d, -0.72, 0, 0.08, 0.30, g, g + 0.30, aspecto.pelo);        // pelo
      }
      parte(L, cx, cy, d, -0.52, 0, 0.28, 0.28, g + 0.02, g + 0.28, aspecto.piel);   // cabeza
      parte(L, cx, cy, d, -0.05, 0, 0.66, 0.42, g, g + 0.18, aspecto.camiseta);      // torso
      parte(L, cx, cy, d, -0.05, -0.27, 0.50, 0.11, g, g + 0.14, aspecto.camiseta);  // brazo
      parte(L, cx, cy, d, -0.05, 0.27, 0.50, 0.11, g, g + 0.14, aspecto.camiseta);   // brazo
      parte(L, cx, cy, d, 0.50, 0, 0.46, 0.34, g, g + 0.13, aspecto.pantalon);       // piernas
      parte(L, cx, cy, d, 0.78, -0.09, 0.12, 0.13, g, g + 0.20, aspecto.zapatos);    // pie
      parte(L, cx, cy, d, 0.78, 0.09, 0.12, 0.13, g, g + 0.20, aspecto.zapatos);     // pie
      // ojos mirando al techo
      parte(L, cx, cy, d, -0.47, -0.06, 0.05, 0.05, g + 0.28, g + 0.31, "negro");
      parte(L, cx, cy, d, -0.47, 0.06, 0.05, 0.05, g + 0.28, g + 0.31, "negro");
      return L;
    }

    if (av.pose === "sentado") {
      parte(L, cx, cy, d, 0.10, 0, 0.44, 0.38, g, g + 0.15, aspecto.pantalon);       // muslos
      parte(L, cx, cy, d, 0.30, -0.10, 0.14, 0.14, Math.max(0, g - 0.38), g + 0.02, aspecto.pantalon);
      parte(L, cx, cy, d, 0.30, 0.10, 0.14, 0.14, Math.max(0, g - 0.38), g + 0.02, aspecto.pantalon);
      parte(L, cx, cy, d, 0.32, -0.10, 0.16, 0.14, 0, 0.12, aspecto.zapatos);
      parte(L, cx, cy, d, 0.32, 0.10, 0.16, 0.14, 0, 0.12, aspecto.zapatos);
      parte(L, cx, cy, d, -0.06, 0, 0.26, 0.42, g + 0.12, g + 0.66, aspecto.camiseta); // torso
      parte(L, cx, cy, d, -0.06, -0.28, 0.16, 0.12, g + 0.40, g + 0.64, aspecto.camiseta); // manga
      parte(L, cx, cy, d, -0.06, 0.28, 0.16, 0.12, g + 0.40, g + 0.64, aspecto.camiseta);
      parte(L, cx, cy, d, -0.06, -0.28, 0.16, 0.12, g + 0.24, g + 0.40, aspecto.piel);     // mano
      parte(L, cx, cy, d, -0.06, 0.28, 0.16, 0.12, g + 0.24, g + 0.40, aspecto.piel);
      parte(L, cx, cy, d, -0.06, 0, 0.30, 0.30, g + 0.68, g + 0.96, aspecto.piel);   // cabeza
      pelo(L, cx, cy, d, -0.06, g + 0.68);
      if (d === 0 || d === 1) {
        parte(L, cx, cy, d, 0.11, -0.07, 0.03, 0.06, g + 0.78, g + 0.84, "negro");
        parte(L, cx, cy, d, 0.11, 0.07, 0.03, 0.06, g + 0.78, g + 0.84, "negro");
      }
      return L;
    }

    // parado / andando
    var sw = (av.pose === "andando") ? Math.sin(av.fase || 0) * 0.15 : 0;
    parte(L, cx, cy, d, sw, -0.10, 0.15, 0.14, g, g + 0.12, aspecto.zapatos);
    parte(L, cx, cy, d, -sw, 0.10, 0.15, 0.14, g, g + 0.12, aspecto.zapatos);
    parte(L, cx, cy, d, sw, -0.10, 0.15, 0.14, g + 0.12, g + 0.62, aspecto.pantalon);
    parte(L, cx, cy, d, -sw, 0.10, 0.15, 0.14, g + 0.12, g + 0.62, aspecto.pantalon);
    parte(L, cx, cy, d, 0, 0, 0.26, 0.42, g + 0.62, g + 1.16, aspecto.camiseta);     // torso
    parte(L, cx, cy, d, -sw * 0.6, -0.28, 0.16, 0.12, g + 0.88, g + 1.14, aspecto.camiseta); // manga
    parte(L, cx, cy, d, sw * 0.6, 0.28, 0.16, 0.12, g + 0.88, g + 1.14, aspecto.camiseta);
    parte(L, cx, cy, d, -sw * 0.6, -0.28, 0.16, 0.12, g + 0.70, g + 0.88, aspecto.piel);     // mano
    parte(L, cx, cy, d, sw * 0.6, 0.28, 0.16, 0.12, g + 0.70, g + 0.88, aspecto.piel);
    parte(L, cx, cy, d, 0, 0, 0.30, 0.30, g + 1.18, g + 1.46, aspecto.piel);         // cabeza
    pelo(L, cx, cy, d, 0, g + 1.18);
    if (d === 0 || d === 1) {
      parte(L, cx, cy, d, 0.165, -0.07, 0.03, 0.06, g + 1.28, g + 1.34, "negro");
      parte(L, cx, cy, d, 0.165, 0.07, 0.03, 0.06, g + 1.28, g + 1.34, "negro");
    }
    return L;
  }

  function dibujar(ctx, av) {
    if (av.pose === "parado" || av.pose === "andando") {
      Iso.sombra(ctx, av.x - 0.26, av.y - 0.26, 0.52, 0.52);
    }
    var partes = Iso.ordenarCajas(partesDe(av));
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i];
      Iso.cubo(ctx, p.x0, p.y0, p.z0, p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0, p.color);
    }
  }

  // Vista previa del avatar (panel de personalización)
  function miniatura(canvas, dir) {
    var ambientePrevio = Paleta.ambiente();
    Paleta.ponAmbiente("manana"); // vista previa siempre con luz de día
    try {
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height * 0.84);
      var esc = Math.min(canvas.width / 95, canvas.height / 115) * 1.3;
      ctx.scale(esc, esc);
      Iso.plano(ctx, -0.55, -0.55, 0, 1.1, 1.1, "beige");
      dibujar(ctx, { x: 0, y: 0, dir: dir === undefined ? 1 : dir, pose: "parado", fase: 0, gz: 0 });
      ctx.restore();
    } finally {
      Paleta.ponAmbiente(ambientePrevio);
    }
  }

  // Caja envolvente para el orden de pintado de la sala
  function caja(av) {
    var m = 0.34;
    return {
      x0: av.x - m, y0: av.y - m, z0: 0,
      x1: av.x + m, y1: av.y + m, z1: (av.gz || 0) + 1.7
    };
  }

  return {
    dibujar: dibujar,
    caja: caja,
    miniatura: miniatura,
    ponAspecto: ponAspecto,
    PEINADOS: PEINADOS
  };
})();
