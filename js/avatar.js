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

  var ROPA = {
    piel: "piel",
    camiseta: "turquesa",
    pantalon: "gris_oscuro",
    zapatos: "negro",
    pelo: "madera_oscura"
  };

  // Añade un cubo definido en el marco local del avatar
  function parte(L, cx, cy, dir, a, b, df, ds, z0, z1, color) {
    var D = DIRS[dir], sx = -D.fy, sy = D.fx;
    var ox = cx + D.fx * a + sx * b;
    var oy = cy + D.fy * a + sy * b;
    var tx = Math.abs(D.fx) * df + Math.abs(sx) * ds;
    var ty = Math.abs(D.fy) * df + Math.abs(sy) * ds;
    L.push({ x0: ox - tx / 2, y0: oy - ty / 2, z0: z0, x1: ox + tx / 2, y1: oy + ty / 2, z1: z1, color: color });
  }

  function partesDe(av) {
    var L = [], cx = av.x, cy = av.y, d = av.dir || 0, g = av.gz || 0;

    if (av.pose === "tumbado") {
      // cuerpo horizontal: la cabeza queda hacia -dir (almohada)
      parte(L, cx, cy, d, -0.72, 0, 0.08, 0.30, g, g + 0.30, ROPA.pelo);        // pelo
      parte(L, cx, cy, d, -0.52, 0, 0.28, 0.28, g + 0.02, g + 0.28, ROPA.piel); // cabeza
      parte(L, cx, cy, d, -0.05, 0, 0.66, 0.42, g, g + 0.18, ROPA.camiseta);    // torso
      parte(L, cx, cy, d, -0.05, -0.27, 0.50, 0.11, g, g + 0.14, ROPA.camiseta); // brazo
      parte(L, cx, cy, d, -0.05, 0.27, 0.50, 0.11, g, g + 0.14, ROPA.camiseta);  // brazo
      parte(L, cx, cy, d, 0.50, 0, 0.46, 0.34, g, g + 0.13, ROPA.pantalon);     // piernas
      parte(L, cx, cy, d, 0.78, -0.09, 0.12, 0.13, g, g + 0.20, ROPA.zapatos);  // pie
      parte(L, cx, cy, d, 0.78, 0.09, 0.12, 0.13, g, g + 0.20, ROPA.zapatos);   // pie
      // ojos mirando al techo
      parte(L, cx, cy, d, -0.47, -0.06, 0.05, 0.05, g + 0.28, g + 0.31, "negro");
      parte(L, cx, cy, d, -0.47, 0.06, 0.05, 0.05, g + 0.28, g + 0.31, "negro");
      return L;
    }

    if (av.pose === "sentado") {
      parte(L, cx, cy, d, 0.10, 0, 0.44, 0.38, g, g + 0.15, ROPA.pantalon);      // muslos
      parte(L, cx, cy, d, 0.30, -0.10, 0.14, 0.14, Math.max(0, g - 0.38), g + 0.02, ROPA.pantalon); // espinilla
      parte(L, cx, cy, d, 0.30, 0.10, 0.14, 0.14, Math.max(0, g - 0.38), g + 0.02, ROPA.pantalon);
      parte(L, cx, cy, d, 0.32, -0.10, 0.16, 0.14, 0, 0.12, ROPA.zapatos);       // zapatos
      parte(L, cx, cy, d, 0.32, 0.10, 0.16, 0.14, 0, 0.12, ROPA.zapatos);
      parte(L, cx, cy, d, -0.06, 0, 0.26, 0.42, g + 0.12, g + 0.66, ROPA.camiseta); // torso
      parte(L, cx, cy, d, -0.06, -0.28, 0.16, 0.12, g + 0.40, g + 0.64, ROPA.camiseta); // manga
      parte(L, cx, cy, d, -0.06, 0.28, 0.16, 0.12, g + 0.40, g + 0.64, ROPA.camiseta);
      parte(L, cx, cy, d, -0.06, -0.28, 0.16, 0.12, g + 0.24, g + 0.40, ROPA.piel);     // mano
      parte(L, cx, cy, d, -0.06, 0.28, 0.16, 0.12, g + 0.24, g + 0.40, ROPA.piel);
      parte(L, cx, cy, d, -0.06, 0, 0.30, 0.30, g + 0.68, g + 0.96, ROPA.piel);  // cabeza
      parte(L, cx, cy, d, -0.08, 0, 0.34, 0.34, g + 0.92, g + 1.06, ROPA.pelo);  // pelo
      parte(L, cx, cy, d, -0.22, 0, 0.06, 0.32, g + 0.70, g + 0.96, ROPA.pelo);  // nuca
      if (d === 0 || d === 1) {
        parte(L, cx, cy, d, 0.11, -0.07, 0.03, 0.06, g + 0.78, g + 0.84, "negro");
        parte(L, cx, cy, d, 0.11, 0.07, 0.03, 0.06, g + 0.78, g + 0.84, "negro");
      }
      return L;
    }

    // parado / andando
    var sw = (av.pose === "andando") ? Math.sin(av.fase || 0) * 0.15 : 0;
    parte(L, cx, cy, d, sw, -0.10, 0.15, 0.14, g, g + 0.12, ROPA.zapatos);
    parte(L, cx, cy, d, -sw, 0.10, 0.15, 0.14, g, g + 0.12, ROPA.zapatos);
    parte(L, cx, cy, d, sw, -0.10, 0.15, 0.14, g + 0.12, g + 0.62, ROPA.pantalon);
    parte(L, cx, cy, d, -sw, 0.10, 0.15, 0.14, g + 0.12, g + 0.62, ROPA.pantalon);
    parte(L, cx, cy, d, 0, 0, 0.26, 0.42, g + 0.62, g + 1.16, ROPA.camiseta);    // torso
    parte(L, cx, cy, d, -sw * 0.6, -0.28, 0.16, 0.12, g + 0.88, g + 1.14, ROPA.camiseta); // manga
    parte(L, cx, cy, d, sw * 0.6, 0.28, 0.16, 0.12, g + 0.88, g + 1.14, ROPA.camiseta);
    parte(L, cx, cy, d, -sw * 0.6, -0.28, 0.16, 0.12, g + 0.70, g + 0.88, ROPA.piel);     // mano
    parte(L, cx, cy, d, sw * 0.6, 0.28, 0.16, 0.12, g + 0.70, g + 0.88, ROPA.piel);
    parte(L, cx, cy, d, 0, 0, 0.30, 0.30, g + 1.18, g + 1.46, ROPA.piel);        // cabeza
    parte(L, cx, cy, d, -0.02, 0, 0.34, 0.34, g + 1.42, g + 1.56, ROPA.pelo);    // pelo
    parte(L, cx, cy, d, -0.16, 0, 0.06, 0.32, g + 1.20, g + 1.46, ROPA.pelo);    // nuca
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

  // Caja envolvente para el orden de pintado de la sala
  function caja(av) {
    var m = 0.34;
    return {
      x0: av.x - m, y0: av.y - m, z0: 0,
      x1: av.x + m, y1: av.y + m, z1: (av.gz || 0) + 1.7
    };
  }

  return { dibujar: dibujar, caja: caja };
})();
