"use strict";

// ============================================================
// FURNIS — catálogo completo de muebles. Cada furni se
// construye SOLO con las primitivas del Pincel (cubo, plano,
// cilindro) usando coordenadas LOCALES con rotación 0 (mirando
// hacia +x los que tienen orientación). El pincel aplica la
// rotación y ordena las piezas automáticamente.
//
// Convenciones:
//  - rot = dirección a la que mira quien lo usa: 0=+x, 1=+y,
//    2=−x, 3=−y. Los furnis de 2 rotaciones usan {0,1}.
//  - alturas en múltiplos de media casilla (asiento 0.5,
//    mesa 1.0, respaldo 1.25...).
//  - capa: "furni" (bloquea el paso salvo bloquea:false),
//    "alfombra" (bajo los furnis, no bloquea) o "pared".
// ============================================================
var Furnis = (function () {
  // ----------------------------------------------------------
  // PINCEL: transforma coordenadas locales → mundo según la
  // rotación y acumula piezas para ordenarlas al pintar.
  // ----------------------------------------------------------
  function Pincel(an, fo, rot) {
    this.an = an;
    this.fo = fo;
    this.rot = rot || 0;
    this.partes = [];
  }

  Pincel.prototype._caja = function (lx, ly, w, d) {
    switch (this.rot) {
      case 1:
        return { x: this.fo - ly - d, y: lx, w: d, d: w };
      case 2:
        return { x: this.an - lx - w, y: this.fo - ly - d, w: w, d: d };
      case 3:
        return { x: ly, y: this.an - lx - w, w: d, d: w };
      default:
        return { x: lx, y: ly, w: w, d: d };
    }
  };

  Pincel.prototype._punto = function (lx, ly) {
    switch (this.rot) {
      case 1:
        return { x: this.fo - ly, y: lx };
      case 2:
        return { x: this.an - lx, y: this.fo - ly };
      case 3:
        return { x: ly, y: this.an - lx };
      default:
        return { x: lx, y: ly };
    }
  };

  Pincel.prototype.cubo = function (lx, ly, z, w, d, h, color) {
    var c = this._caja(lx, ly, w, d);
    this.partes.push({
      tipo: "cubo",
      color: color,
      x0: c.x,
      y0: c.y,
      z0: z,
      x1: c.x + c.w,
      y1: c.y + c.d,
      z1: z + h,
    });
  };

  Pincel.prototype.plano = function (lx, ly, z, w, d, color) {
    var c = this._caja(lx, ly, w, d);
    this.partes.push({
      tipo: "plano",
      color: color,
      x0: c.x,
      y0: c.y,
      z0: z,
      x1: c.x + c.w,
      y1: c.y + c.d,
      z1: z + 0.01,
    });
  };

  Pincel.prototype.cilindro = function (lcx, lcy, z, radio, alto, color) {
    var p = this._punto(lcx, lcy);
    this.partes.push({
      tipo: "cilindro",
      color: color,
      cx: p.x,
      cy: p.y,
      radio: radio,
      alto: alto,
      x0: p.x - radio,
      y0: p.y - radio,
      z0: z,
      x1: p.x + radio,
      y1: p.y + radio,
      z1: z + alto,
    });
  };

  // Pieza plana sobre una pared ("x" = pared a lo largo del eje
  // x en y=0; "y" = pared a lo largo del eje y en x=0).
  // u = avance a lo largo de la pared, sal = cuánto sobresale.
  function pieza(ctx, pared, u, z, wu, wz, sal, color) {
    if (pared === "y") Iso.cubo(ctx, -sal, u, z, sal, wu, wz, color);
    else Iso.cubo(ctx, u, -sal, z, wu, sal, wz, color);
  }

  // ----------------------------------------------------------
  // Registro
  // ----------------------------------------------------------
  var defs = {};
  var orden = [];

  var CATEGORIAS = [
    ["mesas", "Mesas"],
    ["sillas", "Sillas"],
    ["camas", "Camas"],
    ["sofas", "Sofás"],
    ["alfombras", "Alfombras"],
    ["plantas", "Plantas"],
    ["piscinas", "Piscinas"],
    ["almacenaje", "Almacenaje"],
    ["electro", "Electro"],
    ["iluminacion", "Iluminación"],
    ["pared", "Pared"],
    ["jardin", "Jardín"],
    ["baile", "Fiesta"],
    ["casino", "Casino"],
    ["otros", "Otros"],
  ];

  function def(f) {
    if (f.bloquea === undefined) f.bloquea = true;
    if (f.capa === undefined) f.capa = "furni";
    if (f.rotaciones === undefined) f.rotaciones = 1;
    if (f.sentable === undefined) f.sentable = null;
    defs[f.id] = f;
    orden.push(f.id);
  }

  // Ayudantes de construcción
  function patas4(p, x0, y0, x1, y1, gr, alto, color) {
    p.cubo(x0, y0, 0, gr, gr, alto, color);
    p.cubo(x1 - gr, y0, 0, gr, gr, alto, color);
    p.cubo(x0, y1 - gr, 0, gr, gr, alto, color);
    p.cubo(x1 - gr, y1 - gr, 0, gr, gr, alto, color);
  }

  function libros(p, x, y0, z, alto, colores) {
    var y = y0;
    for (var i = 0; i < colores.length; i++) {
      var w = 0.13 + (i % 2) * 0.03;
      p.cubo(x, y, z, 0.3, w, alto - (i % 3) * 0.06, colores[i]);
      y += w + 0.02;
    }
  }

  // ==========================================================
  // MESAS
  // ==========================================================

  def({
    id: "mesa_madera",
    nombre: "Mesa de madera",
    categoria: "mesas",
    precio: 60,
    tam: [1, 1],
    altura: 1.0,
    dibujar: function (p) {
      patas4(p, 0.1, 0.1, 0.9, 0.9, 0.12, 0.85, "madera_oscura");
      p.cubo(0, 0, 0.85, 1, 1, 0.15, "madera");
    },
  });

  def({
    id: "mesa_comedor",
    nombre: "Mesa de comedor",
    categoria: "mesas",
    precio: 110,
    tam: [2, 1],
    altura: 1.0,
    rotaciones: 2,
    dibujar: function (p) {
      patas4(p, 0.12, 0.12, 1.88, 0.88, 0.14, 0.85, "madera_oscura");
      p.cubo(0, 0, 0.85, 2, 1, 0.15, "madera");
    },
  });

  def({
    id: "mesa_baja",
    nombre: "Mesa baja",
    categoria: "mesas",
    precio: 45,
    tam: [1, 1],
    altura: 0.5,
    dibujar: function (p) {
      patas4(p, 0.12, 0.12, 0.88, 0.88, 0.12, 0.38, "madera_oscura");
      p.cubo(0.02, 0.02, 0.38, 0.96, 0.96, 0.12, "madera_oscura");
    },
  });

  def({
    id: "escritorio",
    nombre: "Escritorio",
    categoria: "mesas",
    precio: 90,
    tam: [2, 1],
    altura: 1.0,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0.06, 0.04, 0, 0.14, 0.92, 0.85, "madera_oscura"); // panel izq
      p.cubo(1.8, 0.04, 0, 0.14, 0.92, 0.85, "madera_oscura"); // panel der
      p.cubo(0.2, 0.04, 0.35, 1.6, 0.12, 0.5, "madera"); // trasera
      p.cubo(0, 0, 0.85, 2, 1, 0.15, "madera"); // tablero
    },
  });

  def({
    id: "escritorio_ordenador",
    nombre: "Escritorio con ordenador",
    categoria: "mesas",
    precio: 170,
    tam: [2, 1],
    altura: 1.62,
    rotaciones: 4,
    luz: { x: 0.85, y: 0.44, z: 1.38, radio: 50, color: [130, 225, 215] },
    dibujar: function (p) {
      p.cubo(0.06, 0.04, 0, 0.14, 0.92, 0.85, "madera_oscura");
      p.cubo(1.8, 0.04, 0, 0.14, 0.92, 0.85, "madera_oscura");
      p.cubo(0.2, 0.04, 0.35, 1.6, 0.12, 0.5, "madera");
      p.cubo(0, 0, 0.85, 2, 1, 0.15, "madera");
      // ordenador
      p.cubo(0.79, 0.3, 1.0, 0.12, 0.1, 0.17, "gris_oscuro"); // soporte
      p.cubo(0.55, 0.26, 1.15, 0.6, 0.1, 0.45, "gris_oscuro"); // monitor
      p.cubo(0.59, 0.355, 1.19, 0.52, 0.03, 0.37, "turquesa"); // pantalla
      p.cubo(0.65, 0.58, 1.0, 0.42, 0.22, 0.05, "gris"); // teclado
      p.cubo(1.3, 0.62, 1.0, 0.12, 0.16, 0.05, "gris"); // ratón
    },
  });

  def({
    id: "velador",
    nombre: "Mesita con lámpara",
    categoria: "mesas",
    precio: 95,
    tam: [1, 1],
    altura: 1.25,
    luz: { x: 0.5, y: 0.5, z: 1.07, radio: 78, color: [255, 212, 120] },
    dibujar: function (p) {
      patas4(p, 0.16, 0.16, 0.84, 0.84, 0.1, 0.38, "madera_oscura");
      p.cubo(0.06, 0.06, 0.38, 0.88, 0.88, 0.12, "madera_oscura");
      p.cilindro(0.5, 0.5, 0.5, 0.04, 0.45, "gris_oscuro"); // poste
      p.cilindro(0.5, 0.5, 0.92, 0.22, 0.3, "amarillo"); // pantalla
    },
  });

  // ==========================================================
  // SILLAS
  // ==========================================================

  function silla(p, colorCuerpo, colorPatas) {
    var m = 0.18,
      pt = 0.1;
    patas4(p, m, m, 1 - m, 1 - m, pt, 0.35, colorPatas);
    p.cubo(m, m, 0.35, 0.12, 0.64, 0.9, colorCuerpo);
    p.cubo(m + 0.12, m, 0.35, 0.52, 0.64, 0.15, colorCuerpo);
  }

  def({
    id: "silla_roja",
    nombre: "Silla roja",
    categoria: "sillas",
    precio: 45,
    tam: [1, 1],
    altura: 1.25,
    rotaciones: 4,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      silla(p, "rojo", "madera_oscura");
    },
  });

  def({
    id: "silla_madera",
    nombre: "Silla de madera",
    categoria: "sillas",
    precio: 40,
    tam: [1, 1],
    altura: 1.25,
    rotaciones: 4,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      silla(p, "madera", "madera_oscura");
    },
  });

  def({
    id: "taburete",
    nombre: "Taburete",
    categoria: "sillas",
    precio: 30,
    tam: [1, 1],
    altura: 0.5,
    rotaciones: 1,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      patas4(p, 0.28, 0.28, 0.72, 0.72, 0.12, 0.38, "madera_oscura");
      p.cilindro(0.5, 0.5, 0.38, 0.32, 0.12, "naranja");
    },
  });

  def({
    id: "silla_oficina",
    nombre: "Silla de oficina",
    categoria: "sillas",
    precio: 85,
    tam: [1, 1],
    altura: 1.14,
    rotaciones: 4,
    sentable: "sentado",
    alturaAsiento: 0.52,
    dibujar: function (p) {
      p.cubo(0.14, 0.44, 0, 0.72, 0.12, 0.07, "negro");
      p.cubo(0.44, 0.14, 0, 0.12, 0.72, 0.07, "negro");
      p.cilindro(0.5, 0.5, 0.07, 0.06, 0.31, "gris_oscuro");
      p.cubo(0.2, 0.18, 0.38, 0.56, 0.64, 0.14, "negro");
      p.cubo(0.17, 0.18, 0.52, 0.1, 0.64, 0.62, "negro");
    },
  });

  def({
    id: "banco_madera",
    nombre: "Banco de madera",
    categoria: "sillas",
    precio: 60,
    tam: [1, 2],
    altura: 0.5,
    rotaciones: 4,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0.2, 0.08, 0, 0.14, 0.14, 0.38, "madera_oscura");
      p.cubo(0.6, 0.08, 0, 0.14, 0.14, 0.38, "madera_oscura");
      p.cubo(0.2, 1.78, 0, 0.14, 0.14, 0.38, "madera_oscura");
      p.cubo(0.6, 1.78, 0, 0.14, 0.14, 0.38, "madera_oscura");
      p.cubo(0.15, 0, 0.38, 0.7, 2, 0.12, "madera");
    },
  });

  // ==========================================================
  // CAMAS
  // ==========================================================

  function cama(p, colorManta) {
    p.cubo(0, 0, 0, 0.12, 1, 0.9, "madera_oscura");
    p.cubo(0.12, 0, 0, 1.88, 1, 0.25, "madera");
    p.cubo(0.16, 0.05, 0.25, 1.8, 0.9, 0.18, "blanco");
    p.cubo(0.24, 0.18, 0.43, 0.42, 0.64, 0.12, "crema");
    p.cubo(0.8, 0.02, 0.3, 1.18, 0.96, 0.16, colorManta);
  }

  def({
    id: "cama_azul",
    nombre: "Cama azul",
    categoria: "camas",
    precio: 180,
    tam: [2, 1],
    altura: 0.9,
    rotaciones: 2,
    sentable: "tumbado",
    alturaAsiento: 0.46,
    dibujar: function (p) {
      cama(p, "azul");
    },
  });

  def({
    id: "cama_roja",
    nombre: "Cama roja",
    categoria: "camas",
    precio: 180,
    tam: [2, 1],
    altura: 0.9,
    rotaciones: 2,
    sentable: "tumbado",
    alturaAsiento: 0.46,
    dibujar: function (p) {
      cama(p, "rojo");
    },
  });

  def({
    id: "cama_doble",
    nombre: "Cama doble",
    categoria: "camas",
    precio: 320,
    tam: [2, 2],
    altura: 0.95,
    rotaciones: 2,
    sentable: "tumbado",
    alturaAsiento: 0.46,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 0.12, 2, 0.95, "madera_oscura");
      p.cubo(0.12, 0, 0, 1.88, 2, 0.25, "madera");
      p.cubo(0.16, 0.06, 0.25, 1.8, 1.88, 0.18, "blanco");
      p.cubo(0.24, 0.22, 0.43, 0.42, 0.62, 0.12, "crema");
      p.cubo(0.24, 1.16, 0.43, 0.42, 0.62, 0.12, "crema");
      p.cubo(0.8, 0.03, 0.3, 1.18, 1.94, 0.16, "morado");
    },
  });

  // ==========================================================
  // SOFÁS Y ASIENTOS BLANDOS
  // ==========================================================

  function sofa(p, color, colorCojin) {
    p.cubo(0, 0, 0, 1, 2, 0.3, color);
    p.cubo(0, 0, 0.3, 0.26, 2, 0.7, color);
    p.cubo(0.26, 0, 0.3, 0.74, 0.16, 0.4, color);
    p.cubo(0.28, 0.18, 0.3, 0.66, 0.8, 0.2, colorCojin);
    p.cubo(0.28, 1.02, 0.3, 0.66, 0.8, 0.2, colorCojin);
    p.cubo(0.26, 1.84, 0.3, 0.74, 0.16, 0.4, color);
  }

  def({
    id: "sofa_azul",
    nombre: "Sofá azul",
    categoria: "sofas",
    precio: 220,
    tam: [1, 2],
    altura: 1.0,
    rotaciones: 4,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      sofa(p, "azul", "azul_claro");
    },
  });

  def({
    id: "sofa_rojo",
    nombre: "Sofá rojo",
    categoria: "sofas",
    precio: 220,
    tam: [1, 2],
    altura: 1.0,
    rotaciones: 4,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      sofa(p, "rojo", "crema");
    },
  });

  def({
    id: "sillon_verde",
    nombre: "Sillón verde",
    categoria: "sofas",
    precio: 130,
    tam: [1, 1],
    altura: 1.0,
    rotaciones: 4,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 1, 1, 0.3, "verde");
      p.cubo(0, 0, 0.3, 0.26, 1, 0.7, "verde");
      p.cubo(0.26, 0, 0.3, 0.74, 0.14, 0.4, "verde");
      p.cubo(0.28, 0.16, 0.3, 0.66, 0.68, 0.2, "crema");
      p.cubo(0.26, 0.86, 0.3, 0.74, 0.14, 0.4, "verde");
    },
  });

  def({
    id: "puf_amarillo",
    nombre: "Puf amarillo",
    categoria: "sofas",
    precio: 55,
    tam: [1, 1],
    altura: 0.45,
    rotaciones: 1,
    sentable: "sentado",
    alturaAsiento: 0.44,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.36, 0.4, "amarillo");
      p.cilindro(0.5, 0.5, 0.4, 0.1, 0.05, "naranja");
    },
  });

  // ==========================================================
  // ALFOMBRAS (capa alfombra: no bloquean, van bajo los furnis)
  // ==========================================================

  function alfombra(id, nombre, precio, tam, capas, raro) {
    def({
      id: id,
      nombre: nombre,
      categoria: "alfombras",
      precio: precio,
      tam: tam,
      altura: 0.06,
      rotaciones: tam[0] === tam[1] ? 1 : 2,
      capa: "alfombra",
      bloquea: false,
      raro: raro || false,
      dibujar: function (p) {
        for (var i = 0; i < capas.length; i++) {
          var c = capas[i];
          p.plano(c[0], c[1], 0.02 + i * 0.015, c[2], c[3], c[4]);
        }
      },
    });
  }

  alfombra(
    "alfombra_roja",
    "Alfombra roja",
    70,
    [2, 2],
    [
      [0, 0, 2, 2, "rojo"],
      [0.18, 0.18, 1.64, 1.64, "crema"],
    ],
  );
  alfombra(
    "alfombra_azul",
    "Alfombra azul",
    70,
    [2, 2],
    [
      [0, 0, 2, 2, "azul"],
      [0.18, 0.18, 1.64, 1.64, "azul_claro"],
    ],
  );
  alfombra(
    "alfombra_beige",
    "Alfombra grande",
    100,
    [3, 2],
    [
      [0, 0, 3, 2, "beige"],
      [0.2, 0.2, 2.6, 1.6, "crema"],
      [0.5, 0.45, 2.0, 1.1, "beige"],
    ],
  );
  alfombra(
    "felpudo",
    "Felpudo",
    15,
    [1, 1],
    [
      [0.06, 0.1, 0.88, 0.8, "marron"],
      [0.14, 0.18, 0.72, 0.64, "crema"],
    ],
  );

  def({
    id: "alfombra_redonda",
    nombre: "Alfombra redonda",
    categoria: "alfombras",
    precio: 80,
    tam: [2, 2],
    altura: 0.06,
    capa: "alfombra",
    bloquea: false,
    raro: true,
    dibujar: function (p) {
      p.cilindro(1, 1, 0, 0.95, 0.02, "turquesa");
      p.cilindro(1, 1, 0.02, 0.6, 0.02, "crema");
    },
  });

  // ==========================================================
  // PLANTAS
  // ==========================================================

  def({
    id: "planta_helecho",
    nombre: "Planta helecho",
    categoria: "plantas",
    precio: 35,
    tam: [1, 1],
    altura: 1.3,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.2, 0.3, "marron");
      p.cilindro(0.5, 0.5, 0.3, 0.23, 0.08, "marron");
      p.cilindro(0.5, 0.5, 0.38, 0.05, 0.28, "verde_oscuro");
      p.cilindro(0.3, 0.36, 0.52, 0.19, 0.2, "verde_oscuro");
      p.cilindro(0.7, 0.44, 0.56, 0.2, 0.22, "verde");
      p.cilindro(0.44, 0.7, 0.5, 0.2, 0.2, "verde");
      p.cilindro(0.52, 0.48, 0.66, 0.22, 0.24, "verde");
      p.cilindro(0.5, 0.5, 0.9, 0.13, 0.22, "verde_oscuro");
    },
  });

  def({
    id: "cactus",
    nombre: "Cactus",
    categoria: "plantas",
    precio: 40,
    tam: [1, 1],
    altura: 1.15,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.18, 0.25, "marron");
      p.cilindro(0.5, 0.5, 0.25, 0.13, 0.75, "verde_oscuro");
      p.cubo(0.24, 0.44, 0.6, 0.24, 0.12, 0.12, "verde_oscuro"); // codo
      p.cubo(0.24, 0.44, 0.6, 0.12, 0.12, 0.34, "verde_oscuro"); // brazo
      p.cilindro(0.5, 0.5, 1.0, 0.06, 0.1, "rosa"); // flor
    },
  });

  def({
    id: "ficus",
    nombre: "Ficus",
    categoria: "plantas",
    precio: 90,
    tam: [1, 1],
    altura: 1.9,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.32, "marron");
      p.cilindro(0.5, 0.5, 0.32, 0.07, 0.65, "madera_oscura");
      p.cilindro(0.46, 0.54, 0.85, 0.3, 0.36, "verde_oscuro");
      p.cilindro(0.56, 0.42, 1.15, 0.28, 0.34, "verde");
      p.cilindro(0.5, 0.5, 1.45, 0.2, 0.3, "verde");
    },
  });

  def({
    id: "flores",
    nombre: "Maceta de flores",
    categoria: "plantas",
    precio: 25,
    tam: [1, 1],
    altura: 0.85,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.2, 0.24, "naranja");
      p.cilindro(0.36, 0.44, 0.24, 0.03, 0.34, "verde_oscuro");
      p.cilindro(0.58, 0.38, 0.24, 0.03, 0.42, "verde_oscuro");
      p.cilindro(0.52, 0.62, 0.24, 0.03, 0.28, "verde_oscuro");
      p.cilindro(0.36, 0.44, 0.58, 0.09, 0.12, "rosa");
      p.cilindro(0.58, 0.38, 0.66, 0.09, 0.12, "amarillo");
      p.cilindro(0.52, 0.62, 0.52, 0.09, 0.12, "morado");
    },
  });

  def({
    id: "bonsai",
    nombre: "Bonsái",
    categoria: "plantas",
    precio: 60,
    tam: [1, 1],
    altura: 0.6,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.28, 0.12, "gris");
      p.cilindro(0.46, 0.48, 0.12, 0.05, 0.2, "madera_oscura");
      p.cilindro(0.52, 0.46, 0.3, 0.24, 0.14, "verde");
      p.cilindro(0.34, 0.62, 0.24, 0.12, 0.1, "verde_oscuro");
    },
  });

  // ==========================================================
  // PISCINAS
  // ==========================================================

  function piscina(p, ancho, fondo, agua) {
    var borde = 0.18;
    var altura = 0.75;
    var ribete = 0.08;
    var interiorX = ancho - borde * 2;
    var interiorY = fondo - borde * 2;
    // fondo con color de agua y superficie visible
    p.plano(borde, borde, 0.04, interiorX, interiorY, agua);
    p.plano(
      borde + 0.1,
      borde + 0.1,
      0.18,
      interiorX - 0.2,
      interiorY - 0.2,
      "azul_claro",
    );
    p.plano(borde + 0.4, borde + 0.2, 0.2, 0.45, 0.08, "blanco");
    p.plano(borde + 0.2, borde + 0.6, 0.2, 0.45, 0.08, "blanco");
    // paredes altas tipo lona
    p.cubo(0, 0, 0, ancho, borde, altura, "azul");
    p.cubo(0, fondo - borde, 0, ancho, borde, altura, "azul");
    p.cubo(0, borde, 0, borde, interiorY, altura, "azul");
    p.cubo(ancho - borde, borde, 0, borde, interiorY, altura, "azul");
    // ribete superior y tiras de refuerzo
    p.cubo(0, 0, altura - ribete, ancho, borde, ribete, "azul_claro");
    p.cubo(
      0,
      fondo - borde,
      altura - ribete,
      ancho,
      borde,
      ribete,
      "azul_claro",
    );
    p.cubo(0, borde, altura - ribete, borde, interiorY, ribete, "azul_claro");
    p.cubo(
      ancho - borde,
      borde,
      altura - ribete,
      borde,
      interiorY,
      ribete,
      "azul_claro",
    );
    // costuras verticales simuladas
    var seccion = 0.06;
    if (interiorX >= 1.0) {
      p.cubo(borde + 0.4, 0, 0.06, seccion, borde, altura - 0.16, "azul_claro");
      p.cubo(
        interiorX - 0.4,
        0,
        0.06,
        seccion,
        borde,
        altura - 0.16,
        "azul_claro",
      );
      p.cubo(
        borde + 0.4,
        fondo - borde,
        0.06,
        seccion,
        borde,
        altura - 0.16,
        "azul_claro",
      );
      p.cubo(
        interiorX - 0.4,
        fondo - borde,
        0.06,
        seccion,
        borde,
        altura - 0.16,
        "azul_claro",
      );
    }
    if (interiorY >= 1.0) {
      p.cubo(0, borde + 0.4, 0.06, borde, seccion, altura - 0.16, "azul_claro");
      p.cubo(
        ancho - borde,
        borde + 0.4,
        0.06,
        borde,
        seccion,
        altura - 0.16,
        "azul_claro",
      );
    }
  }

  def({
    id: "piscina_pequena",
    nombre: "Piscina pequeña",
    categoria: "piscinas",
    precio: 240,
    tam: [2, 2],
    altura: 0.75,
    rotaciones: 2,
    dibujar: function (p) {
      piscina(p, 2, 2, "azul_claro");
    },
  });

  def({
    id: "piscina_grande",
    nombre: "Piscina grande",
    categoria: "piscinas",
    precio: 420,
    tam: [3, 2],
    altura: 0.75,
    rotaciones: 2,
    dibujar: function (p) {
      piscina(p, 3, 2, "azul");
    },
  });

  def({
    id: "tumbona_piscina",
    nombre: "Tumbona de piscina",
    categoria: "piscinas",
    precio: 90,
    tam: [1, 2],
    altura: 0.8,
    rotaciones: 2,
    dibujar: function (p) {
      p.cubo(0, 0.2, 0, 1, 1.6, 0.14, "madera");
      p.cubo(0.1, 0.2, 0.14, 0.8, 1.6, 0.08, "blanco");
      p.cubo(0.12, 0.2, 0.22, 0.76, 1.6, 0.1, "turquesa");
      p.cubo(0.12, 0, 0.08, 0.04, 0.2, 0.6, "madera_oscura");
      p.cubo(0.84, 0, 0.08, 0.04, 0.2, 0.6, "madera_oscura");
    },
  });

  // ==========================================================
  // ALMACENAJE
  // ==========================================================

  def({
    id: "estanteria",
    nombre: "Estantería",
    categoria: "almacenaje",
    precio: 140,
    tam: [1, 1],
    altura: 2.0,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 0.5, 0.07, 2.0, "madera"); // lateral
      p.cubo(0, 0.93, 0, 0.5, 0.07, 2.0, "madera"); // lateral
      p.cubo(0, 0.07, 0, 0.1, 0.86, 2.0, "madera_oscura"); // trasera
      p.cubo(0.1, 0.07, 0.02, 0.36, 0.86, 0.05, "madera");
      p.cubo(0.1, 0.07, 0.68, 0.36, 0.86, 0.05, "madera");
      p.cubo(0.1, 0.07, 1.34, 0.36, 0.86, 0.05, "madera");
      p.cubo(0, 0, 1.94, 0.5, 1, 0.06, "madera"); // techo
      libros(p, 0.12, 0.12, 0.07, 0.5, ["rojo", "azul", "verde", "amarillo"]);
      libros(p, 0.12, 0.16, 0.73, 0.5, ["morado", "turquesa", "naranja"]);
      libros(p, 0.12, 0.12, 1.39, 0.44, ["azul", "rojo", "verde_oscuro"]);
    },
  });

  def({
    id: "estanteria_baja",
    nombre: "Estantería baja",
    categoria: "almacenaje",
    precio: 85,
    tam: [1, 1],
    altura: 1.35,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 0.5, 0.07, 1.0, "madera");
      p.cubo(0, 0.93, 0, 0.5, 0.07, 1.0, "madera");
      p.cubo(0, 0.07, 0, 0.1, 0.86, 1.0, "madera_oscura");
      p.cubo(0.1, 0.07, 0.02, 0.36, 0.86, 0.05, "madera");
      p.cubo(0, 0, 0.94, 0.5, 1, 0.06, "madera");
      libros(p, 0.12, 0.14, 0.07, 0.48, ["verde", "naranja", "azul"]);
      p.cilindro(0.25, 0.5, 1.0, 0.12, 0.3, "turquesa"); // jarrón
    },
  });

  def({
    id: "comoda",
    nombre: "Cómoda",
    categoria: "almacenaje",
    precio: 100,
    tam: [1, 1],
    altura: 0.97,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0.1, 0.06, 0, 0.72, 0.88, 0.9, "madera");
      p.cubo(0.06, 0.02, 0.9, 0.8, 0.96, 0.07, "madera_oscura");
      p.cubo(0.82, 0.1, 0.12, 0.06, 0.8, 0.3, "madera_oscura");
      p.cubo(0.82, 0.1, 0.5, 0.06, 0.8, 0.3, "madera_oscura");
      p.cubo(0.88, 0.46, 0.22, 0.03, 0.08, 0.08, "gris");
      p.cubo(0.88, 0.46, 0.6, 0.03, 0.08, 0.08, "gris");
    },
  });

  def({
    id: "armario",
    nombre: "Armario",
    categoria: "almacenaje",
    precio: 200,
    tam: [1, 1],
    altura: 2.15,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0.08, 0.05, 0, 0.72, 0.9, 2.05, "madera_oscura");
      p.cubo(0.8, 0.08, 0.06, 0.07, 0.4, 1.92, "madera");
      p.cubo(0.8, 0.52, 0.06, 0.07, 0.4, 1.92, "madera");
      p.cubo(0.87, 0.42, 0.9, 0.03, 0.05, 0.2, "gris");
      p.cubo(0.87, 0.53, 0.9, 0.03, 0.05, 0.2, "gris");
    },
  });

  def({
    id: "baul",
    nombre: "Baúl",
    categoria: "almacenaje",
    precio: 70,
    tam: [1, 1],
    altura: 0.62,
    rotaciones: 2,
    dibujar: function (p) {
      p.cubo(0.08, 0.12, 0, 0.84, 0.76, 0.42, "madera");
      p.cubo(0.05, 0.09, 0.42, 0.9, 0.82, 0.18, "madera_oscura");
      p.cubo(0.42, 0.08, 0.43, 0.16, 0.84, 0.18, "gris"); // banda
    },
  });

  // ==========================================================
  // ELECTRO
  // ==========================================================

  def({
    id: "tele",
    nombre: "Televisión",
    categoria: "electro",
    precio: 190,
    tam: [1, 1],
    altura: 0.95,
    rotaciones: 4,
    luz: { x: 0.64, y: 0.5, z: 0.64, radio: 55, color: [150, 215, 255] },
    dibujar: function (p) {
      p.cubo(0.3, 0.2, 0, 0.3, 0.6, 0.12, "gris_oscuro"); // base
      p.cubo(0.42, 0.42, 0.12, 0.12, 0.16, 0.25, "gris_oscuro"); // soporte
      p.cubo(0.5, 0.08, 0.37, 0.1, 0.84, 0.55, "negro"); // panel
      p.cubo(0.575, 0.14, 0.42, 0.035, 0.72, 0.44, "azul_claro"); // pantalla
    },
  });

  def({
    id: "nevera",
    nombre: "Nevera",
    categoria: "electro",
    precio: 220,
    tam: [1, 1],
    altura: 1.85,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0.12, 0.08, 0, 0.78, 0.84, 1.85, "blanco");
      p.cubo(0.9, 0.1, 1.3, 0.02, 0.8, 0.03, "gris"); // línea congelador
      p.cubo(0.9, 0.72, 1.42, 0.04, 0.06, 0.24, "gris_oscuro"); // tirador arriba
      p.cubo(0.9, 0.72, 0.9, 0.04, 0.06, 0.32, "gris_oscuro"); // tirador abajo
    },
  });

  def({
    id: "lavadora",
    nombre: "Lavadora",
    categoria: "electro",
    precio: 150,
    tam: [1, 1],
    altura: 0.9,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0.12, 0.1, 0, 0.76, 0.8, 0.8, "blanco");
      p.cubo(0.12, 0.1, 0.8, 0.76, 0.8, 0.06, "gris");
      p.cubo(0.88, 0.28, 0.18, 0.04, 0.44, 0.44, "gris"); // marco puerta
      p.cubo(0.92, 0.36, 0.26, 0.02, 0.28, 0.28, "azul_claro"); // ventana
      p.cubo(0.88, 0.16, 0.68, 0.04, 0.1, 0.08, "turquesa"); // botón
    },
  });

  def({
    id: "equipo_musica",
    nombre: "Equipo de música",
    categoria: "electro",
    precio: 130,
    tam: [1, 1],
    altura: 1.0,
    rotaciones: 4,
    dibujar: function (p) {
      p.cubo(0.3, 0.05, 0, 0.4, 0.25, 0.7, "negro"); // altavoz
      p.cubo(0.3, 0.7, 0, 0.4, 0.25, 0.7, "negro"); // altavoz
      p.cubo(0.3, 0.34, 0, 0.4, 0.32, 0.9, "gris_oscuro"); // torre
      p.cubo(0.7, 0.4, 0.7, 0.02, 0.2, 0.05, "turquesa"); // luces
      p.cubo(0.7, 0.4, 0.55, 0.02, 0.2, 0.03, "amarillo");
    },
  });

  // ==========================================================
  // ILUMINACIÓN
  // ==========================================================

  def({
    id: "lampara_pie",
    nombre: "Lámpara de pie",
    categoria: "iluminacion",
    precio: 75,
    tam: [1, 1],
    altura: 1.75,
    luz: { x: 0.5, y: 0.5, z: 1.5, radio: 95, color: [255, 212, 120] },
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.2, 0.06, "gris_oscuro");
      p.cilindro(0.5, 0.5, 0.06, 0.035, 1.28, "gris_oscuro");
      p.cilindro(0.5, 0.5, 1.3, 0.24, 0.42, "amarillo");
    },
  });

  def({
    id: "farol",
    nombre: "Farol de suelo",
    categoria: "iluminacion",
    precio: 65,
    tam: [1, 1],
    altura: 0.9,
    luz: { x: 0.5, y: 0.5, z: 0.42, radio: 70, color: [255, 170, 80] },
    dibujar: function (p) {
      p.cubo(0.26, 0.26, 0, 0.48, 0.48, 0.08, "negro");
      p.cubo(0.3, 0.3, 0.08, 0.4, 0.4, 0.55, "naranja");
      p.cubo(0.26, 0.26, 0.63, 0.48, 0.48, 0.1, "negro");
      p.cilindro(0.5, 0.5, 0.73, 0.06, 0.1, "negro");
    },
  });

  // ==========================================================
  // PARED (cuadros y espejos: se cuelgan en las dos paredes)
  // ==========================================================

  function cuadro(id, nombre, precio, raro, pintar) {
    def({
      id: id,
      nombre: nombre,
      categoria: "pared",
      precio: precio,
      tam: [1, 1],
      altura: 0.9,
      capa: "pared",
      bloquea: false,
      raro: raro,
      zPared: 1.06,
      altoPared: 0.72,
      dibujarPared: function (ctx, pared, u) {
        pintar(ctx, pared, u);
      },
      dibujar: function () {}, // no se usa: los de pared tienen dibujarPared
    });
  }

  cuadro("cuadro_paisaje", "Cuadro: paisaje", 80, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.1, 1.06, 0.8, 0.68, 0.045, "madera_oscura");
    pieza(ctx, pa, u + 0.15, 1.11, 0.7, 0.58, 0.06, "azul_claro");
    pieza(ctx, pa, u + 0.15, 1.11, 0.7, 0.22, 0.07, "verde");
    pieza(ctx, pa, u + 0.34, 1.28, 0.16, 0.12, 0.075, "verde_oscuro");
    pieza(ctx, pa, u + 0.62, 1.47, 0.13, 0.13, 0.075, "amarillo");
  });

  cuadro(
    "cuadro_abstracto",
    "Cuadro: abstracto",
    80,
    false,
    function (ctx, pa, u) {
      pieza(ctx, pa, u + 0.1, 1.06, 0.8, 0.68, 0.045, "negro");
      pieza(ctx, pa, u + 0.15, 1.11, 0.7, 0.58, 0.06, "crema");
      pieza(ctx, pa, u + 0.2, 1.18, 0.18, 0.18, 0.07, "rojo");
      pieza(ctx, pa, u + 0.45, 1.35, 0.22, 0.14, 0.07, "azul");
      pieza(ctx, pa, u + 0.28, 1.44, 0.14, 0.14, 0.07, "amarillo");
      pieza(ctx, pa, u + 0.55, 1.16, 0.12, 0.2, 0.07, "turquesa");
    },
  );

  cuadro("cuadro_retrato", "Cuadro: retrato", 60, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.16, 1.06, 0.68, 0.68, 0.045, "madera");
    pieza(ctx, pa, u + 0.21, 1.11, 0.58, 0.58, 0.06, "morado");
    pieza(ctx, pa, u + 0.33, 1.13, 0.34, 0.16, 0.07, "gris_oscuro"); // cuerpo
    pieza(ctx, pa, u + 0.39, 1.29, 0.22, 0.22, 0.07, "piel"); // cara
    pieza(ctx, pa, u + 0.37, 1.48, 0.26, 0.12, 0.075, "madera_oscura"); // pelo
  });

  cuadro("espejo", "Espejo", 120, true, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.14, 1.02, 0.72, 0.76, 0.045, "gris_oscuro");
    pieza(ctx, pa, u + 0.19, 1.07, 0.62, 0.66, 0.06, "azul_claro");
    pieza(ctx, pa, u + 0.28, 1.42, 0.08, 0.22, 0.07, "blanco"); // brillo
    pieza(ctx, pa, u + 0.4, 1.22, 0.08, 0.3, 0.07, "blanco");
  });

  // ==========================================================
  // OTROS
  // ==========================================================

  def({
    id: "papelera",
    nombre: "Papelera",
    categoria: "otros",
    precio: 20,
    tam: [1, 1],
    altura: 0.45,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.22, 0.42, "gris");
      p.cilindro(0.5, 0.5, 0.42, 0.17, 0.02, "gris_oscuro");
    },
  });

  def({
    id: "acuario",
    nombre: "Acuario",
    categoria: "otros",
    precio: 260,
    tam: [2, 1],
    altura: 1.1,
    rotaciones: 4,
    raro: true,
    dibujar: function (p) {
      // vacío: los peces son mascotas y viven dentro (jardín)
      p.cubo(0.05, 0.05, 0, 1.9, 0.9, 0.45, "madera_oscura"); // mueble
      p.cubo(0.1, 0.1, 0.45, 1.8, 0.8, 0.55, "turquesa"); // agua
      p.cubo(0.05, 0.05, 1.0, 1.9, 0.9, 0.08, "gris_oscuro"); // tapa
      p.cubo(0.85, 0.9, 0.52, 0.05, 0.06, 0.05, "blanco"); // burbuja
      p.cubo(1.45, 0.9, 0.7, 0.04, 0.05, 0.04, "blanco"); // burbuja
    },
  });

  def({
    id: "chimenea",
    nombre: "Chimenea",
    categoria: "otros",
    precio: 300,
    tam: [2, 1],
    altura: 1.6,
    rotaciones: 4,
    raro: true,
    luz: { x: 1.0, y: 0.88, z: 0.35, radio: 105, color: [255, 150, 60] },
    dibujar: function (p) {
      p.cubo(0, 0.15, 0, 2, 0.55, 1.5, "gris"); // trasera
      p.cubo(0, 0.7, 0, 0.35, 0.3, 1.5, "gris"); // lado izq
      p.cubo(1.65, 0.7, 0, 0.35, 0.3, 1.5, "gris"); // lado der
      p.cubo(0.35, 0.7, 0.83, 1.3, 0.3, 0.67, "gris"); // dintel
      p.cubo(0.35, 0.7, 0, 1.3, 0.3, 0.06, "gris_oscuro"); // suelo del hogar
      p.cubo(0.35, 0.66, 0.06, 1.3, 0.06, 0.77, "negro"); // fondo del hueco
      p.cilindro(0.85, 0.88, 0.06, 0.15, 0.36, "naranja"); // fuego
      p.cilindro(1.15, 0.88, 0.06, 0.12, 0.27, "amarillo");
      p.cubo(0, 0.08, 1.5, 2, 0.96, 0.1, "gris_oscuro"); // repisa
    },
  });

  // ==========================================================
  // JARDÍN (aviario para pájaros + recompensas exclusivas
  // desbloqueadas por la felicidad de las mascotas)
  // ==========================================================

  def({
    id: "aviario",
    nombre: "Aviario",
    categoria: "jardin",
    precio: 300,
    tam: [1, 1],
    altura: 1.85,
    dibujar: function (p) {
      p.cubo(0.05, 0.05, 0, 0.9, 0.9, 0.1, "gris_oscuro"); // base
      // postes de las esquinas
      p.cubo(0.08, 0.08, 0.1, 0.05, 0.05, 1.5, "gris_oscuro");
      p.cubo(0.87, 0.08, 0.1, 0.05, 0.05, 1.5, "gris_oscuro");
      p.cubo(0.08, 0.87, 0.1, 0.05, 0.05, 1.5, "gris_oscuro");
      p.cubo(0.87, 0.87, 0.1, 0.05, 0.05, 1.5, "gris_oscuro");
      // percha
      p.cubo(0.15, 0.48, 0.7, 0.7, 0.04, 0.04, "madera");
      // barrotes de las caras visibles
      p.cubo(0.88, 0.28, 0.1, 0.03, 0.03, 1.5, "gris_oscuro");
      p.cubo(0.88, 0.49, 0.1, 0.03, 0.03, 1.5, "gris_oscuro");
      p.cubo(0.88, 0.7, 0.1, 0.03, 0.03, 1.5, "gris_oscuro");
      p.cubo(0.28, 0.88, 0.1, 0.03, 0.03, 1.5, "gris_oscuro");
      p.cubo(0.49, 0.88, 0.1, 0.03, 0.03, 1.5, "gris_oscuro");
      p.cubo(0.7, 0.88, 0.1, 0.03, 0.03, 1.5, "gris_oscuro");
      // techo y remate
      p.cubo(0.05, 0.05, 1.6, 0.9, 0.9, 0.07, "gris_oscuro");
      p.cilindro(0.5, 0.5, 1.67, 0.1, 0.16, "amarillo");
    },
  });

  def({
    id: "fuente",
    nombre: "Fuente de piedra",
    categoria: "jardin",
    precio: 0,
    recompensa: true,
    desbloqueo: "3 mascotas muy felices en el jardín",
    tam: [1, 1],
    altura: 1.35,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.45, 0.24, "gris"); // pila
      p.cilindro(0.5, 0.5, 0.24, 0.37, 0.05, "turquesa"); // agua
      p.cilindro(0.5, 0.5, 0.24, 0.08, 0.55, "gris"); // columna
      p.cilindro(0.5, 0.5, 0.79, 0.2, 0.07, "gris"); // plato
      p.cilindro(0.5, 0.5, 0.86, 0.14, 0.04, "turquesa"); // agua plato
      p.cilindro(0.5, 0.5, 0.9, 0.04, 0.32, "azul_claro"); // chorro
    },
  });

  def({
    id: "gnomo",
    nombre: "Gnomo de jardín",
    categoria: "jardin",
    precio: 0,
    recompensa: true,
    desbloqueo: "5 mascotas muy felices en el jardín",
    tam: [1, 1],
    altura: 0.85,
    dibujar: function (p) {
      p.cilindro(0.46, 0.5, 0, 0.09, 0.06, "negro"); // pies
      p.cilindro(0.58, 0.5, 0, 0.09, 0.06, "negro");
      p.cilindro(0.5, 0.5, 0.06, 0.15, 0.3, "azul"); // cuerpo
      p.cubo(0.36, 0.42, 0.2, 0.1, 0.16, 0.1, "piel"); // manos
      p.cilindro(0.5, 0.5, 0.36, 0.11, 0.08, "blanco"); // barba
      p.cilindro(0.5, 0.5, 0.44, 0.1, 0.14, "piel"); // cabeza
      p.cilindro(0.5, 0.5, 0.58, 0.11, 0.12, "rojo"); // gorro
      p.cilindro(0.5, 0.5, 0.7, 0.06, 0.12, "rojo"); // punta gorro
    },
  });

  // ==========================================================
  // FIESTA (la sala de baile y sus desbloqueos)
  // ==========================================================

  def({
    id: "equipo_dj",
    nombre: "Equipo de DJ",
    categoria: "baile",
    precio: 350,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.15,
    luz: { x: 1, y: 0.5, z: 1.1, radio: 42, color: [88, 178, 164] },
    dibujar: function (p) {
      p.cubo(0.05, 0.1, 0, 0.9, 0.8, 0.9, "negro");            // mueble izq
      p.cubo(1.05, 0.1, 0, 0.9, 0.8, 0.9, "negro");            // mueble der
      p.cubo(0, 0.05, 0.9, 2, 0.9, 0.12, "gris_oscuro");       // tablero
      p.cilindro(0.5, 0.5, 1.02, 0.28, 0.05, "gris");          // plato 1
      p.cilindro(0.5, 0.5, 1.07, 0.1, 0.03, "negro");
      p.cilindro(1.5, 0.5, 1.02, 0.28, 0.05, "gris");          // plato 2
      p.cilindro(1.5, 0.5, 1.07, 0.1, 0.03, "negro");
      p.cubo(0.86, 0.3, 1.02, 0.28, 0.4, 0.08, "gris_oscuro"); // mezclador
      p.cubo(0.9, 0.36, 1.1, 0.06, 0.06, 0.04, "turquesa");
      p.cubo(1.04, 0.36, 1.1, 0.06, 0.06, 0.04, "rojo");
      p.cubo(0.97, 0.52, 1.1, 0.06, 0.14, 0.03, "amarillo");
    },
  });

  def({
    id: "altavoz",
    nombre: "Altavoz de torre",
    categoria: "baile",
    precio: 180,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.6,
    dibujar: function (p) {
      p.cubo(0.15, 0.15, 0, 0.7, 0.7, 1.5, "negro");             // caja
      p.cubo(0.82, 0.28, 0.85, 0.06, 0.44, 0.44, "gris_oscuro"); // cono grande
      p.cubo(0.82, 0.36, 0.3, 0.06, 0.28, 0.28, "gris_oscuro");  // cono chico
      p.cubo(0.15, 0.15, 1.5, 0.7, 0.7, 0.07, "gris_oscuro");    // remate
    },
  });

  def({
    id: "bola_disco",
    nombre: "Bola de disco",
    categoria: "baile",
    precio: 0,
    recompensa: true,
    desbloqueo: "Tarea diaria: Decorador del día",
    tam: [1, 1],
    altura: 2.1,
    luz: { x: 0.5, y: 0.5, z: 1.75, radio: 55, color: [216, 146, 171] },
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.3, 0.08, "gris_oscuro");       // base
      p.cilindro(0.5, 0.5, 0.08, 0.05, 1.5, "gris");           // mástil
      p.cilindro(0.5, 0.5, 1.55, 0.24, 0.42, "azul_claro");    // bola
      p.cubo(0.36, 0.4, 1.62, 0.08, 0.08, 0.08, "blanco");     // destellos
      p.cubo(0.58, 0.34, 1.78, 0.08, 0.08, 0.08, "blanco");
      p.cubo(0.46, 0.6, 1.7, 0.08, 0.08, 0.08, "blanco");
    },
  });

  def({
    id: "foco_disco",
    nombre: "Foco de colores",
    categoria: "baile",
    precio: 220,
    tam: [1, 1],
    rotaciones: 4,
    altura: 2.0,
    luz: { x: 0.5, y: 0.5, z: 1.7, radio: 48, color: [143, 111, 180] },
    dibujar: function (p) {
      p.cubo(0.28, 0.28, 0, 0.44, 0.44, 0.1, "gris_oscuro");   // base
      p.cilindro(0.5, 0.5, 0.1, 0.06, 1.45, "gris_oscuro");    // mástil
      p.cubo(0.3, 0.32, 1.55, 0.4, 0.36, 0.28, "negro");       // cabezal
      p.cubo(0.68, 0.36, 1.6, 0.06, 0.28, 0.18, "morado");     // lente
      p.cubo(0.42, 0.42, 1.83, 0.16, 0.16, 0.06, "amarillo");  // piloto
    },
  });

  def({
    id: "barra_bar",
    nombre: "Barra de bar",
    categoria: "baile",
    precio: 320,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.1,
    luz: { x: 1, y: 0.3, z: 0.55, radio: 38, color: [88, 178, 164] },
    dibujar: function (p) {
      p.cubo(0.05, 0.2, 0, 1.9, 0.65, 0.95, "gris_oscuro");     // cuerpo
      p.cubo(0, 0.12, 0.95, 2, 0.82, 0.12, "negro");            // encimera
      p.cubo(0.05, 0.17, 0.42, 1.9, 0.05, 0.09, "turquesa");    // tira de neón
      p.cilindro(0.4, 0.55, 1.07, 0.06, 0.28, "verde");         // botellas
      p.cilindro(0.95, 0.55, 1.07, 0.06, 0.34, "azul");
      p.cilindro(1.55, 0.55, 1.07, 0.06, 0.24, "rosa");
      p.cilindro(1.25, 0.45, 1.07, 0.05, 0.12, "blanco");       // vaso
    },
  });

  def({
    id: "taburete_disco",
    nombre: "Taburete de neón",
    categoria: "baile",
    precio: 70,
    tam: [1, 1],
    rotaciones: 4,
    altura: 0.75,
    sentable: "sentado",
    alturaAsiento: 0.68,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.06, "gris_oscuro"); // base
      p.cilindro(0.5, 0.5, 0.06, 0.05, 0.5, "gris");      // pata
      p.cilindro(0.5, 0.5, 0.56, 0.25, 0.12, "rosa");     // asiento
    },
  });

  def({
    id: "sofa_vip",
    nombre: "Sofá VIP",
    categoria: "baile",
    precio: 260,
    tam: [1, 2],
    rotaciones: 4,
    altura: 1.0,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0.05, 0.02, 0, 0.12, 0.2, 0.36, "amarillo");   // patas doradas
      p.cubo(0.05, 1.78, 0, 0.12, 0.2, 0.36, "amarillo");
      p.cubo(0, 0, 0.12, 1, 2, 0.3, "morado");              // asiento
      p.cubo(0, 0, 0.42, 0.26, 2, 0.55, "morado");          // respaldo
      p.cubo(0.26, 0, 0.42, 0.74, 0.14, 0.35, "morado");    // brazo
      p.cubo(0.26, 1.86, 0.42, 0.74, 0.14, 0.35, "morado"); // brazo
      p.cubo(0.28, 0.18, 0.42, 0.66, 0.72, 0.1, "rosa");    // cojines
      p.cubo(0.28, 1.1, 0.42, 0.66, 0.72, 0.1, "rosa");
    },
  });

  def({
    id: "cuerda_vip",
    nombre: "Cordón VIP",
    categoria: "baile",
    precio: 90,
    tam: [1, 1],
    rotaciones: 2,
    altura: 1.0,
    dibujar: function (p) {
      p.cilindro(0.18, 0.5, 0, 0.11, 0.05, "amarillo");     // bases
      p.cilindro(0.82, 0.5, 0, 0.11, 0.05, "amarillo");
      p.cilindro(0.18, 0.5, 0.05, 0.035, 0.8, "amarillo");  // postes
      p.cilindro(0.82, 0.5, 0.05, 0.035, 0.8, "amarillo");
      p.cilindro(0.18, 0.5, 0.85, 0.06, 0.07, "amarillo");  // remates
      p.cilindro(0.82, 0.5, 0.85, 0.06, 0.07, "amarillo");
      p.cubo(0.21, 0.46, 0.6, 0.58, 0.08, 0.1, "rojo");     // cuerda
    },
  });

  def({
    id: "letrero_neon",
    nombre: "Letrero de neón",
    categoria: "baile",
    precio: 150,
    tam: [1, 1],
    altura: 0.9,
    capa: "pared",
    bloquea: false,
    zPared: 1.06,
    altoPared: 0.72,
    dibujarPared: function (ctx, pared, u) {
      pieza(ctx, pared, u + 0.08, 1.04, 0.84, 0.72, 0.04, "negro"); // panel
      // ecualizador de neón
      pieza(ctx, pared, u + 0.16, 1.12, 0.1, 0.26, 0.055, "rosa");
      pieza(ctx, pared, u + 0.3, 1.12, 0.1, 0.48, 0.055, "turquesa");
      pieza(ctx, pared, u + 0.44, 1.12, 0.1, 0.34, 0.055, "amarillo");
      pieza(ctx, pared, u + 0.58, 1.12, 0.1, 0.56, 0.055, "morado");
      pieza(ctx, pared, u + 0.72, 1.12, 0.1, 0.2, 0.055, "verde");
    },
    dibujar: function () {}, // no se usa: los de pared tienen dibujarPared
  });

  // ==========================================================
  // CASINO — muebles exclusivos de la sala casino. Todos llevan
  // zona: "casino": solo se pueden colocar allí, y los muebles
  // normales no pueden entrar (lo valida Sala.validar). Los que
  // tienen juegoCasino abren su juego al pulsarlos en modo
  // pasear (mesa de póker: aún solo decorativa).
  // ==========================================================

  def({
    id: "mesa_blackjack",
    nombre: "Mesa de blackjack",
    categoria: "casino",
    zona: "casino",
    juegoCasino: "blackjack",
    precio: 900,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.0,
    dibujar: function (p) {
      patas4(p, 0.1, 0.1, 1.9, 0.9, 0.14, 0.8, "madera_oscura");
      p.cubo(0, 0, 0.8, 2, 1, 0.15, "madera_oscura");             // tablero
      p.cubo(0.1, 0.1, 0.95, 1.8, 0.8, 0.03, "verde_oscuro");     // tapete
      p.cubo(0.1, 0.1, 0.95, 1.8, 0.07, 0.035, "amarillo");       // ribete dorado
      p.cubo(0.5, 0.55, 0.98, 0.22, 0.16, 0.02, "blanco");        // cartas
      p.cubo(0.78, 0.5, 0.98, 0.22, 0.16, 0.02, "blanco");
      p.cilindro(1.5, 0.38, 0.98, 0.07, 0.06, "rojo");            // fichas
      p.cilindro(1.32, 0.3, 0.98, 0.07, 0.04, "azul");
    },
  });

  def({
    id: "ruleta_casino",
    nombre: "Ruleta",
    categoria: "casino",
    zona: "casino",
    juegoCasino: "ruleta",
    precio: 1200,
    tam: [2, 2],
    rotaciones: 4,
    altura: 1.3,
    dibujar: function (p) {
      p.cubo(0.1, 0.1, 0, 1.8, 1.8, 0.85, "madera_oscura");        // cuerpo
      p.cubo(0, 0, 0.85, 2, 2, 0.15, "madera_oscura");             // tablero
      p.cubo(0.08, 0.08, 1.0, 1.84, 1.84, 0.02, "verde_oscuro");   // tapete
      p.cilindro(0.62, 1.0, 1.02, 0.5, 0.08, "madera");            // aro
      p.cilindro(0.62, 1.0, 1.1, 0.4, 0.05, "rojo");               // rueda
      p.cilindro(0.62, 1.0, 1.15, 0.28, 0.04, "negro");
      p.cilindro(0.62, 1.0, 1.19, 0.08, 0.1, "amarillo");          // eje dorado
      p.cubo(1.3, 0.35, 1.02, 0.5, 0.3, 0.01, "rojo");             // paño de apuestas
      p.cubo(1.3, 0.85, 1.02, 0.5, 0.3, 0.01, "negro");
      p.cilindro(1.55, 1.5, 1.02, 0.07, 0.06, "amarillo");         // fichas
      p.cilindro(1.38, 1.55, 1.02, 0.07, 0.04, "rojo");
    },
  });

  def({
    id: "tragaperras",
    nombre: "Tragaperras",
    categoria: "casino",
    zona: "casino",
    juegoCasino: "tragaperras",
    precio: 750,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.9,
    luz: { x: 0.82, y: 0.5, z: 1.0, radio: 42, color: [255, 205, 110] },
    dibujar: function (p) {
      p.cubo(0.15, 0.2, 0, 0.7, 0.6, 1.1, "rojo");                 // cuerpo
      p.cubo(0.12, 0.16, 1.1, 0.76, 0.68, 0.5, "rojo");            // cabezal
      p.cubo(0.1, 0.14, 1.6, 0.8, 0.72, 0.2, "amarillo");          // marquesina
      p.cubo(0.82, 0.28, 0.72, 0.06, 0.44, 0.34, "blanco");        // ventana de rodillos
      p.cubo(0.86, 0.32, 0.8, 0.04, 0.1, 0.14, "rojo");            // símbolos
      p.cubo(0.86, 0.45, 0.8, 0.04, 0.1, 0.14, "amarillo");
      p.cubo(0.86, 0.58, 0.8, 0.04, 0.1, 0.14, "turquesa");
      p.cubo(0.82, 0.36, 0.36, 0.08, 0.28, 0.12, "gris_oscuro");   // bandeja de premios
      p.cilindro(0.5, 0.1, 0.95, 0.03, 0.42, "gris");              // palanca
      p.cilindro(0.5, 0.1, 1.37, 0.07, 0.09, "rojo");              // bola de la palanca
    },
  });

  def({
    id: "mesa_dados",
    nombre: "Mesa de dados",
    categoria: "casino",
    zona: "casino",
    juegoCasino: "dados",
    precio: 800,
    tam: [2, 1],
    rotaciones: 2,
    altura: 1.0,
    dibujar: function (p) {
      p.cubo(0.05, 0.1, 0, 1.9, 0.8, 0.7, "madera_oscura");        // cuerpo
      p.cubo(0, 0, 0.7, 2, 0.14, 0.3, "madera_oscura");            // bordes altos
      p.cubo(0, 0.86, 0.7, 2, 0.14, 0.3, "madera_oscura");
      p.cubo(0, 0.14, 0.7, 0.14, 0.72, 0.3, "madera_oscura");
      p.cubo(1.86, 0.14, 0.7, 0.14, 0.72, 0.3, "madera_oscura");
      p.cubo(0.14, 0.14, 0.7, 1.72, 0.72, 0.04, "verde_oscuro");   // tapete hundido
      p.cubo(0.14, 0.14, 0.96, 1.72, 0.04, 0.04, "amarillo");      // moldura dorada
      p.cubo(0.8, 0.4, 0.74, 0.15, 0.15, 0.15, "blanco");          // dados
      p.cubo(1.05, 0.52, 0.74, 0.15, 0.15, 0.15, "blanco");
    },
  });

  def({
    id: "mesa_poker",
    nombre: "Mesa de póker",
    categoria: "casino",
    zona: "casino",
    juegoCasino: "poker",
    precio: 1000,
    tam: [2, 2],
    altura: 1.0,
    dibujar: function (p) {
      p.cilindro(1.0, 1.0, 0, 0.3, 0.1, "madera_oscura");          // base
      p.cilindro(1.0, 1.0, 0.1, 0.16, 0.7, "madera_oscura");       // pie central
      p.cilindro(1.0, 1.0, 0.8, 0.95, 0.12, "madera_oscura");      // canto
      p.cilindro(1.0, 1.0, 0.92, 0.82, 0.04, "verde_oscuro");      // tapete
      p.cubo(0.6, 0.9, 0.96, 0.2, 0.14, 0.02, "blanco");           // cartas
      p.cubo(1.2, 0.78, 0.96, 0.2, 0.14, 0.02, "blanco");
      p.cilindro(1.0, 1.35, 0.96, 0.07, 0.08, "rojo");             // fichas
      p.cilindro(0.75, 1.28, 0.96, 0.07, 0.05, "azul");
      p.cilindro(1.28, 1.25, 0.96, 0.07, 0.06, "amarillo");
    },
  });

  def({
    id: "barra_casino",
    nombre: "Barra del casino",
    categoria: "casino",
    zona: "casino",
    precio: 400,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.15,
    luz: { x: 1, y: 0.4, z: 1.2, radio: 44, color: [255, 205, 110] },
    dibujar: function (p) {
      p.cubo(0.05, 0.2, 0, 1.9, 0.6, 0.95, "madera_oscura");       // cuerpo
      p.cubo(0, 0.12, 0.95, 2, 0.8, 0.12, "madera");               // encimera
      p.cubo(0.05, 0.16, 0.48, 1.9, 0.05, 0.09, "amarillo");       // moldura dorada
      p.cilindro(0.4, 0.5, 1.07, 0.06, 0.3, "verde_oscuro");       // botellas
      p.cilindro(0.95, 0.5, 1.07, 0.06, 0.36, "rojo");
      p.cilindro(1.55, 0.5, 1.07, 0.06, 0.26, "azul");
      p.cilindro(1.25, 0.42, 1.07, 0.05, 0.12, "blanco");          // copa
    },
  });

  def({
    id: "taburete_casino",
    nombre: "Taburete de cuero",
    categoria: "casino",
    zona: "casino",
    precio: 90,
    tam: [1, 1],
    altura: 0.8,
    sentable: "sentado",
    alturaAsiento: 0.68,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.06, "amarillo");             // base dorada
      p.cilindro(0.5, 0.5, 0.06, 0.05, 0.5, "amarillo");
      p.cilindro(0.5, 0.5, 0.56, 0.26, 0.14, "marron");            // asiento de cuero
    },
  });

  def({
    id: "sofa_cuero",
    nombre: "Sofá de cuero",
    categoria: "casino",
    zona: "casino",
    precio: 320,
    tam: [1, 2],
    rotaciones: 4,
    altura: 1.05,
    sentable: "sentado",
    alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0.05, 0.06, 0, 0.14, 0.14, 0.14, "amarillo");         // patas doradas
      p.cubo(0.05, 1.8, 0, 0.14, 0.14, 0.14, "amarillo");
      p.cubo(0, 0, 0.14, 1, 2, 0.3, "marron");                     // base
      p.cubo(0, 0, 0.44, 0.26, 2, 0.58, "marron");                 // respaldo
      p.cubo(0.26, 0, 0.44, 0.74, 0.16, 0.32, "madera_oscura");    // brazos
      p.cubo(0.26, 1.84, 0.44, 0.74, 0.16, 0.32, "madera_oscura");
      p.cubo(0.3, 0.2, 0.44, 0.64, 0.72, 0.1, "madera");           // cojines
      p.cubo(0.3, 1.08, 0.44, 0.64, 0.72, 0.1, "madera");
    },
  });

  def({
    id: "alfombra_casino_verde",
    nombre: "Alfombra verde del casino",
    categoria: "casino",
    zona: "casino",
    precio: 120,
    tam: [2, 2],
    altura: 0.06,
    capa: "alfombra",
    bloquea: false,
    dibujar: function (p) {
      p.plano(0, 0, 0.02, 2, 2, "amarillo");
      p.plano(0.14, 0.14, 0.035, 1.72, 1.72, "verde_oscuro");
      p.plano(0.85, 0.85, 0.05, 0.3, 0.3, "amarillo");             // rombo central
    },
  });

  def({
    id: "alfombra_casino_roja",
    nombre: "Alfombra roja del casino",
    categoria: "casino",
    zona: "casino",
    precio: 120,
    tam: [2, 2],
    altura: 0.06,
    capa: "alfombra",
    bloquea: false,
    dibujar: function (p) {
      p.plano(0, 0, 0.02, 2, 2, "amarillo");
      p.plano(0.14, 0.14, 0.035, 1.72, 1.72, "rojo");
      p.plano(0.85, 0.85, 0.05, 0.3, 0.3, "amarillo");             // rombo central
    },
  });

  def({
    id: "lampara_casino",
    nombre: "Lámpara clásica",
    categoria: "casino",
    zona: "casino",
    precio: 160,
    tam: [1, 1],
    altura: 1.9,
    luz: { x: 0.5, y: 0.5, z: 1.55, radio: 80, color: [255, 200, 110] },
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.26, 0.06, "madera_oscura");        // base
      p.cilindro(0.5, 0.5, 0.06, 0.045, 1.3, "amarillo");          // poste dorado
      p.cilindro(0.5, 0.5, 1.36, 0.3, 0.4, "rojo");                // pantalla granate
      p.cilindro(0.5, 0.5, 1.76, 0.08, 0.06, "amarillo");          // remate
    },
  });

  def({
    id: "cartel_casino",
    nombre: "Cartel luminoso",
    categoria: "casino",
    zona: "casino",
    precio: 200,
    tam: [1, 1],
    altura: 0.9,
    capa: "pared",
    bloquea: false,
    zPared: 1.08,
    altoPared: 0.78,
    dibujarPared: function (ctx, pared, u) {
      pieza(ctx, pared, u + 0.05, 1.08, 0.9, 0.78, 0.04, "negro");     // panel
      pieza(ctx, pared, u + 0.1, 1.13, 0.8, 0.12, 0.05, "amarillo");   // franja inferior
      pieza(ctx, pared, u + 0.16, 1.36, 0.16, 0.38, 0.055, "rojo");    // 7 7 7
      pieza(ctx, pared, u + 0.42, 1.36, 0.16, 0.38, 0.055, "amarillo");
      pieza(ctx, pared, u + 0.68, 1.36, 0.16, 0.38, 0.055, "rojo");
      pieza(ctx, pared, u + 0.1, 1.78, 0.08, 0.06, 0.055, "blanco");   // bombillas
      pieza(ctx, pared, u + 0.46, 1.78, 0.08, 0.06, 0.055, "blanco");
      pieza(ctx, pared, u + 0.82, 1.78, 0.08, 0.06, 0.055, "blanco");
    },
    dibujar: function () {}, // no se usa: los de pared tienen dibujarPared
  });

  def({
    id: "planta_casino",
    nombre: "Palmera de salón",
    categoria: "casino",
    zona: "casino",
    precio: 110,
    tam: [1, 1],
    altura: 1.5,
    dibujar: function (p) {
      p.cubo(0.28, 0.28, 0, 0.44, 0.44, 0.35, "amarillo");         // maceta dorada
      p.cilindro(0.5, 0.5, 0.35, 0.05, 0.5, "madera_oscura");      // tronco
      p.cilindro(0.5, 0.5, 0.85, 0.32, 0.26, "verde_oscuro");      // copa
      p.cilindro(0.5, 0.5, 1.11, 0.2, 0.24, "verde");
    },
  });

  // ==========================================================
  // AMPLIACIÓN DEL CATÁLOGO — tanda variada para todas las
  // categorías (mesas, sillas, plantas, electro, pared, jardín,
  // otros...). Mismas reglas: solo primitivas y paleta.
  // ==========================================================

  // --- mesas ---

  def({
    id: "mesa_redonda",
    nombre: "Mesa redonda",
    categoria: "mesas",
    precio: 75,
    tam: [1, 1],
    altura: 0.9,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.28, 0.06, "madera_oscura"); // base
      p.cilindro(0.5, 0.5, 0.06, 0.07, 0.7, "madera_oscura"); // pie
      p.cilindro(0.5, 0.5, 0.76, 0.46, 0.1, "madera"); // tablero
    },
  });

  def({
    id: "tocador",
    nombre: "Tocador con espejo",
    categoria: "mesas",
    precio: 160,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.9,
    dibujar: function (p) {
      p.cubo(0.08, 0.15, 0, 1.84, 0.75, 0.72, "crema");    // mueble
      p.cubo(0, 0.1, 0.72, 2, 0.85, 0.08, "madera");       // tablero
      p.cubo(0.55, 0.4, 0.3, 0.9, 0.45, 0.06, "madera");   // cajón
      p.cubo(0.35, 0.72, 0.8, 1.3, 0.1, 1.0, "madera");    // marco espejo
      p.cubo(0.45, 0.7, 0.9, 1.1, 0.05, 0.8, "azul_claro"); // luna
      p.cilindro(0.25, 0.4, 0.8, 0.06, 0.18, "rosa");      // frasquito
      p.cilindro(1.75, 0.4, 0.8, 0.05, 0.13, "turquesa");  // frasquito
    },
  });

  // --- sillas ---

  def({
    id: "mecedora",
    nombre: "Mecedora",
    categoria: "sillas",
    precio: 95,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.3,
    sentable: "sentado",
    alturaAsiento: 0.45,
    dibujar: function (p) {
      p.cubo(0.05, 0.1, 0, 0.9, 0.09, 0.1, "madera_oscura");  // patín
      p.cubo(0.05, 0.81, 0, 0.9, 0.09, 0.1, "madera_oscura"); // patín
      p.cubo(0.2, 0.15, 0.32, 0.65, 0.7, 0.1, "madera");      // asiento
      p.cubo(0.14, 0.15, 0.42, 0.1, 0.7, 0.85, "madera");     // respaldo
      p.cubo(0.24, 0.15, 0.95, 0.5, 0.08, 0.1, "madera_oscura"); // reposabrazos
      p.cubo(0.24, 0.77, 0.95, 0.5, 0.08, 0.1, "madera_oscura");
    },
  });

  // --- alfombras ---

  alfombra(
    "alfombra_rayas",
    "Alfombra de rayas",
    85,
    [3, 2],
    [
      [0, 0, 3, 2, "crema"],
      [0.3, 0, 0.5, 2, "turquesa"],
      [1.25, 0, 0.5, 2, "rosa"],
      [2.2, 0, 0.5, 2, "amarillo"],
    ],
  );

  // --- plantas ---

  def({
    id: "monstera",
    nombre: "Monstera",
    categoria: "plantas",
    precio: 65,
    tam: [1, 1],
    altura: 1.4,
    bloquea: true,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.3, "naranja");        // maceta
      p.cilindro(0.5, 0.5, 0.3, 0.05, 0.5, "verde_oscuro"); // tallo
      p.cubo(0.1, 0.3, 0.7, 0.42, 0.4, 0.1, "verde");       // hojas grandes
      p.cubo(0.5, 0.25, 0.9, 0.42, 0.42, 0.1, "verde");
      p.cubo(0.25, 0.55, 1.1, 0.4, 0.36, 0.1, "verde_oscuro");
    },
  });

  def({
    id: "girasoles",
    nombre: "Girasoles",
    categoria: "plantas",
    precio: 45,
    tam: [1, 1],
    altura: 1.2,
    dibujar: function (p) {
      p.cubo(0.2, 0.2, 0, 0.6, 0.6, 0.24, "marron");         // jardinera
      p.cilindro(0.35, 0.4, 0.24, 0.03, 0.6, "verde_oscuro"); // tallos
      p.cilindro(0.62, 0.55, 0.24, 0.03, 0.75, "verde_oscuro");
      p.cilindro(0.35, 0.4, 0.84, 0.13, 0.09, "amarillo");   // flores
      p.cilindro(0.35, 0.4, 0.87, 0.05, 0.08, "madera_oscura");
      p.cilindro(0.62, 0.55, 0.99, 0.15, 0.09, "amarillo");
      p.cilindro(0.62, 0.55, 1.02, 0.06, 0.08, "madera_oscura");
    },
  });

  def({
    id: "palmera",
    nombre: "Palmera de interior",
    categoria: "plantas",
    precio: 120,
    tam: [1, 1],
    altura: 2.3,
    bloquea: true,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.3, 0.28, "beige");          // maceta
      p.cilindro(0.5, 0.5, 0.28, 0.09, 0.6, "madera");      // tronco
      p.cilindro(0.5, 0.5, 0.88, 0.07, 0.6, "madera");
      p.cilindro(0.5, 0.5, 1.48, 0.06, 0.3, "madera_oscura");
      p.cubo(0.05, 0.42, 1.78, 0.9, 0.16, 0.09, "verde");   // hojas en cruz
      p.cubo(0.42, 0.05, 1.78, 0.16, 0.9, 0.09, "verde");
      p.cubo(0.15, 0.15, 1.9, 0.7, 0.14, 0.08, "verde_oscuro"); // diagonales
      p.cubo(0.15, 0.71, 1.9, 0.7, 0.14, 0.08, "verde_oscuro");
    },
  });

  // --- almacenaje ---

  def({
    id: "vitrina",
    nombre: "Vitrina de trofeos",
    categoria: "almacenaje",
    precio: 240,
    tam: [1, 1],
    rotaciones: 4,
    altura: 2.0,
    dibujar: function (p) {
      p.cubo(0.1, 0.1, 0, 0.8, 0.8, 0.12, "madera_oscura"); // base
      p.cubo(0.1, 0.14, 0.12, 0.14, 0.72, 1.7, "madera_oscura"); // trasera
      p.cubo(0.24, 0.12, 0.6, 0.6, 0.76, 0.06, "madera");   // estantes
      p.cubo(0.24, 0.12, 1.2, 0.6, 0.76, 0.06, "madera");
      p.cubo(0.1, 0.1, 1.82, 0.8, 0.8, 0.1, "madera_oscura"); // techo
      p.cilindro(0.5, 0.35, 0.66, 0.08, 0.3, "amarillo");   // trofeos
      p.cilindro(0.5, 0.65, 0.66, 0.06, 0.22, "gris");
      p.cilindro(0.5, 0.5, 1.26, 0.09, 0.34, "amarillo");   // la copa gorda
    },
  });

  def({
    id: "caja_fuerte",
    nombre: "Caja fuerte",
    categoria: "almacenaje",
    precio: 150,
    tam: [1, 1],
    rotaciones: 4,
    altura: 0.95,
    dibujar: function (p) {
      p.cubo(0.12, 0.12, 0, 0.76, 0.76, 0.08, "negro");       // patas
      p.cubo(0.1, 0.1, 0.08, 0.8, 0.8, 0.8, "gris_oscuro");   // cuerpo
      p.cubo(0.88, 0.2, 0.2, 0.04, 0.6, 0.56, "gris");        // puerta
      p.cilindro(0.93, 0.5, 0.48, 0.09, 0.04, "negro");       // dial
      p.cubo(0.9, 0.32, 0.6, 0.05, 0.12, 0.05, "amarillo");   // tirador
    },
  });

  // --- electro ---

  def({
    id: "cocina",
    nombre: "Cocina con horno",
    categoria: "electro",
    precio: 300,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.0,
    dibujar: function (p) {
      p.cubo(0.05, 0.1, 0, 1.9, 0.8, 0.88, "blanco");        // mueble
      p.cubo(0, 0.05, 0.88, 2, 0.9, 0.08, "gris_oscuro");    // encimera
      p.cilindro(0.45, 0.35, 0.96, 0.13, 0.03, "negro");     // fogones
      p.cilindro(0.45, 0.68, 0.96, 0.1, 0.03, "negro");
      p.cilindro(0.85, 0.5, 0.96, 0.11, 0.03, "negro");
      p.cubo(1.25, 0.88, 0.3, 0.6, 0.06, 0.45, "negro");     // puerta horno
      p.cubo(1.3, 0.9, 0.78, 0.5, 0.05, 0.05, "gris");       // tirador
      p.cubo(1.35, 0.9, 0.42, 0.4, 0.04, 0.22, "naranja");   // ventana horno
    },
  });

  def({
    id: "ventilador",
    nombre: "Ventilador",
    categoria: "electro",
    precio: 85,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.3,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.26, 0.06, "gris_oscuro");   // base
      p.cilindro(0.5, 0.5, 0.06, 0.05, 0.75, "gris");       // pie
      p.cubo(0.52, 0.28, 0.72, 0.14, 0.44, 0.44, "gris");   // jaula
      p.cubo(0.62, 0.42, 0.84, 0.06, 0.16, 0.2, "azul_claro"); // aspas
      p.cubo(0.62, 0.34, 0.9, 0.06, 0.32, 0.08, "azul_claro");
    },
  });

  def({
    id: "arcade",
    nombre: "Máquina arcade",
    categoria: "electro",
    precio: 420,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.85,
    luz: { x: 0.5, y: 0.5, z: 1.2, radio: 36, color: [88, 178, 164] },
    dibujar: function (p) {
      p.cubo(0.12, 0.15, 0, 0.76, 0.7, 1.15, "morado");      // mueble
      p.cubo(0.7, 0.18, 1.15, 0.24, 0.64, 0.5, "morado");    // cabezal
      p.cubo(0.9, 0.24, 1.22, 0.06, 0.52, 0.36, "turquesa"); // pantalla
      p.cubo(0.5, 0.18, 1.1, 0.3, 0.64, 0.08, "gris_oscuro"); // panel mandos
      p.cilindro(0.6, 0.35, 1.18, 0.04, 0.08, "rojo");       // joystick
      p.cubo(0.62, 0.55, 1.18, 0.07, 0.07, 0.03, "amarillo"); // botones
      p.cubo(0.62, 0.66, 1.18, 0.07, 0.07, 0.03, "verde");
      p.cubo(0.66, 0.15, 1.65, 0.3, 0.7, 0.2, "amarillo");   // marquesina
    },
  });

  // --- iluminación ---

  def({
    id: "lampara_lava",
    nombre: "Lámpara de lava",
    categoria: "iluminacion",
    precio: 130,
    tam: [1, 1],
    altura: 0.95,
    luz: { x: 0.5, y: 0.5, z: 0.6, radio: 34, color: [224, 143, 69] },
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.2, 0.1, "amarillo");     // base
      p.cilindro(0.5, 0.5, 0.1, 0.13, 0.6, "naranja");   // vidrio
      p.cubo(0.42, 0.42, 0.2, 0.14, 0.14, 0.12, "rosa"); // burbujas
      p.cubo(0.48, 0.46, 0.42, 0.12, 0.12, 0.1, "rosa");
      p.cilindro(0.5, 0.5, 0.7, 0.09, 0.14, "amarillo"); // remate
    },
  });

  def({
    id: "candelabro",
    nombre: "Candelabro",
    categoria: "iluminacion",
    precio: 95,
    tam: [1, 1],
    altura: 1.5,
    luz: { x: 0.5, y: 0.5, z: 1.35, radio: 30, color: [228, 194, 90] },
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.22, 0.06, "amarillo");      // base
      p.cilindro(0.5, 0.5, 0.06, 0.04, 1.0, "amarillo");    // pie
      p.cubo(0.15, 0.46, 1.06, 0.7, 0.08, 0.06, "amarillo"); // brazos
      p.cilindro(0.19, 0.5, 1.12, 0.045, 0.18, "blanco");   // velas
      p.cilindro(0.5, 0.5, 1.12, 0.045, 0.24, "blanco");
      p.cilindro(0.81, 0.5, 1.12, 0.045, 0.18, "blanco");
      p.cilindro(0.19, 0.5, 1.3, 0.03, 0.07, "naranja");    // llamas
      p.cilindro(0.5, 0.5, 1.36, 0.03, 0.07, "naranja");
      p.cilindro(0.81, 0.5, 1.3, 0.03, 0.07, "naranja");
    },
  });

  // --- pared ---

  cuadro("estante_flotante", "Balda flotante", 85, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.08, 1.18, 0.84, 0.08, 0.16, "madera");     // balda
    pieza(ctx, pa, u + 0.16, 1.26, 0.14, 0.3, 0.1, "rojo");         // libros
    pieza(ctx, pa, u + 0.31, 1.26, 0.12, 0.26, 0.1, "azul");
    pieza(ctx, pa, u + 0.55, 1.26, 0.16, 0.14, 0.1, "naranja");     // maceta
    pieza(ctx, pa, u + 0.57, 1.4, 0.12, 0.14, 0.1, "verde");        // planta
  });

  cuadro("reloj_pared", "Reloj de pared", 70, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.2, 1.2, 0.6, 0.6, 0.045, "madera_oscura"); // caja
    pieza(ctx, pa, u + 0.26, 1.26, 0.48, 0.48, 0.06, "crema");      // esfera
    pieza(ctx, pa, u + 0.47, 1.48, 0.06, 0.22, 0.07, "negro");      // aguja larga
    pieza(ctx, pa, u + 0.5, 1.47, 0.16, 0.06, 0.07, "negro");       // aguja corta
    pieza(ctx, pa, u + 0.47, 1.47, 0.06, 0.06, 0.075, "rojo");      // centro
  });

  cuadro("ventana_falsa", "Ventana con vistas", 120, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.08, 1.0, 0.84, 0.84, 0.05, "madera");      // marco
    pieza(ctx, pa, u + 0.14, 1.06, 0.72, 0.72, 0.06, "azul_claro"); // cielo
    pieza(ctx, pa, u + 0.14, 1.06, 0.72, 0.2, 0.065, "verde");      // campo
    pieza(ctx, pa, u + 0.6, 1.54, 0.16, 0.16, 0.065, "amarillo");   // sol
    pieza(ctx, pa, u + 0.2, 1.42, 0.26, 0.1, 0.065, "blanco");      // nube
    pieza(ctx, pa, u + 0.47, 1.06, 0.06, 0.72, 0.07, "madera");     // travesaño
  });

  cuadro("poster_futbol", "Póster de fútbol sala", 55, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.1, 1.05, 0.8, 0.75, 0.04, "verde");        // cancha
    pieza(ctx, pa, u + 0.47, 1.05, 0.06, 0.75, 0.05, "blanco");     // línea media
    pieza(ctx, pa, u + 0.34, 1.3, 0.32, 0.26, 0.045, "verde");      // (hueco círculo)
    pieza(ctx, pa, u + 0.36, 1.32, 0.28, 0.22, 0.055, "verde_oscuro"); // círculo central
    pieza(ctx, pa, u + 0.44, 1.38, 0.12, 0.12, 0.065, "blanco");    // balón
  });

  cuadro("diana", "Diana de dardos", 65, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.18, 1.13, 0.64, 0.64, 0.045, "madera_oscura");
    pieza(ctx, pa, u + 0.24, 1.19, 0.52, 0.52, 0.055, "rojo");
    pieza(ctx, pa, u + 0.32, 1.27, 0.36, 0.36, 0.06, "crema");
    pieza(ctx, pa, u + 0.4, 1.35, 0.2, 0.2, 0.065, "rojo");
    pieza(ctx, pa, u + 0.46, 1.41, 0.08, 0.08, 0.07, "negro");     // centro
    pieza(ctx, pa, u + 0.55, 1.44, 0.14, 0.03, 0.075, "amarillo"); // dardo
  });

  // --- jardín ---

  def({
    id: "barbacoa",
    nombre: "Barbacoa",
    categoria: "jardin",
    precio: 170,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.0,
    luz: { x: 0.5, y: 0.5, z: 0.75, radio: 26, color: [224, 143, 69] },
    dibujar: function (p) {
      p.cilindro(0.35, 0.35, 0, 0.04, 0.55, "negro");     // patas
      p.cilindro(0.65, 0.65, 0, 0.04, 0.55, "negro");
      p.cilindro(0.35, 0.65, 0, 0.04, 0.55, "negro");
      p.cilindro(0.65, 0.35, 0, 0.04, 0.55, "negro");
      p.cilindro(0.5, 0.5, 0.5, 0.32, 0.18, "gris_oscuro"); // cuenco
      p.cilindro(0.5, 0.5, 0.66, 0.27, 0.04, "naranja");    // brasas
      p.cubo(0.24, 0.32, 0.7, 0.52, 0.05, 0.03, "gris");    // parrilla
      p.cubo(0.24, 0.5, 0.7, 0.52, 0.05, 0.03, "gris");
      p.cubo(0.24, 0.63, 0.7, 0.52, 0.05, 0.03, "gris");
    },
  });

  def({
    id: "columpio",
    nombre: "Columpio",
    categoria: "jardin",
    precio: 260,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.7,
    sentable: "sentado",
    alturaAsiento: 0.45,
    dibujar: function (p) {
      p.cubo(0.06, 0.08, 0, 0.12, 0.12, 1.5, "madera");     // postes
      p.cubo(0.06, 0.8, 0, 0.12, 0.12, 1.5, "madera");
      p.cubo(0.02, 0.05, 1.5, 0.2, 0.9, 0.12, "madera_oscura"); // travesaño
      p.cubo(0.32, 0.27, 0.42, 0.04, 0.04, 1.08, "gris");   // cuerdas
      p.cubo(0.32, 0.69, 0.42, 0.04, 0.04, 1.08, "gris");
      p.cubo(0.24, 0.22, 0.38, 0.42, 0.56, 0.07, "rojo");   // asiento
    },
  });

  def({
    id: "hamaca",
    nombre: "Hamaca",
    categoria: "jardin",
    precio: 190,
    tam: [2, 1],
    rotaciones: 2,
    altura: 1.1,
    sentable: "tumbado",
    alturaAsiento: 0.55,
    dibujar: function (p) {
      p.cilindro(0.12, 0.5, 0, 0.09, 1.0, "madera_oscura"); // postes
      p.cilindro(1.88, 0.5, 0, 0.09, 1.0, "madera_oscura");
      p.cubo(0.14, 0.2, 0.78, 0.3, 0.6, 0.06, "turquesa");  // tela colgada
      p.cubo(0.44, 0.16, 0.6, 1.12, 0.68, 0.08, "turquesa");
      p.cubo(1.56, 0.2, 0.78, 0.3, 0.6, 0.06, "turquesa");
    },
  });

  def({
    id: "buzon",
    nombre: "Buzón",
    categoria: "jardin",
    precio: 55,
    tam: [1, 1],
    rotaciones: 4,
    altura: 1.2,
    dibujar: function (p) {
      p.cubo(0.44, 0.44, 0, 0.12, 0.12, 0.75, "madera");    // poste
      p.cubo(0.3, 0.28, 0.75, 0.5, 0.44, 0.34, "rojo");     // caja
      p.cubo(0.78, 0.32, 0.79, 0.04, 0.36, 0.26, "rojo");   // tapa
      p.cubo(0.36, 0.47, 1.09, 0.06, 0.06, 0.14, "amarillo"); // bandera
    },
  });

  def({
    id: "espantapajaros",
    nombre: "Espantapájaros",
    categoria: "jardin",
    precio: 95,
    tam: [1, 1],
    altura: 1.8,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.06, 1.1, "madera");        // palo
      p.cubo(0.1, 0.44, 0.85, 0.8, 0.12, 0.12, "madera");  // brazos
      p.cubo(0.3, 0.38, 0.55, 0.4, 0.24, 0.5, "rojo");     // camisa
      p.cilindro(0.5, 0.5, 1.1, 0.14, 0.26, "beige");      // cabeza de saco
      p.cilindro(0.5, 0.5, 1.36, 0.2, 0.06, "amarillo");   // ala sombrero
      p.cilindro(0.5, 0.5, 1.42, 0.11, 0.16, "amarillo");  // copa
    },
  });

  // --- otros ---

  def({
    id: "futbolin",
    nombre: "Futbolín",
    categoria: "otros",
    precio: 380,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.05,
    dibujar: function (p) {
      patas4(p, 0.12, 0.1, 1.88, 0.9, 0.14, 0.6, "madera_oscura");
      p.cubo(0.05, 0.05, 0.6, 1.9, 0.9, 0.28, "madera");   // caja
      p.cubo(0.12, 0.12, 0.82, 1.76, 0.76, 0.06, "verde"); // campo
      p.cubo(0.98, 0.12, 0.83, 0.04, 0.76, 0.06, "blanco"); // línea media
      p.cubo(0.35, 0, 0.94, 0.05, 1, 0.05, "gris");        // barras
      p.cubo(0.85, 0, 0.94, 0.05, 1, 0.05, "gris");
      p.cubo(1.15, 0, 0.94, 0.05, 1, 0.05, "gris");
      p.cubo(1.65, 0, 0.94, 0.05, 1, 0.05, "gris");
      p.cubo(0.34, 0.3, 0.86, 0.07, 0.09, 0.14, "rojo");   // jugadores
      p.cubo(0.34, 0.62, 0.86, 0.07, 0.09, 0.14, "rojo");
      p.cubo(0.84, 0.45, 0.86, 0.07, 0.09, 0.14, "azul");
      p.cubo(1.14, 0.3, 0.86, 0.07, 0.09, 0.14, "rojo");
      p.cubo(1.64, 0.5, 0.86, 0.07, 0.09, 0.14, "azul");
    },
  });

  def({
    id: "piano",
    nombre: "Piano de pared",
    categoria: "otros",
    precio: 520,
    tam: [2, 1],
    rotaciones: 4,
    altura: 1.35,
    dibujar: function (p) {
      p.cubo(0.05, 0.05, 0, 1.9, 0.6, 1.25, "negro");       // cuerpo
      p.cubo(0.1, 0.62, 0.62, 1.8, 0.3, 0.09, "blanco");    // teclado
      p.cubo(0.25, 0.62, 0.71, 0.09, 0.2, 0.05, "negro");   // teclas negras
      p.cubo(0.45, 0.62, 0.71, 0.09, 0.2, 0.05, "negro");
      p.cubo(0.75, 0.62, 0.71, 0.09, 0.2, 0.05, "negro");
      p.cubo(0.95, 0.62, 0.71, 0.09, 0.2, 0.05, "negro");
      p.cubo(1.25, 0.62, 0.71, 0.09, 0.2, 0.05, "negro");
      p.cubo(1.55, 0.62, 0.71, 0.09, 0.2, 0.05, "negro");
      p.cubo(0.4, 0.6, 0.95, 1.2, 0.07, 0.3, "madera");     // atril
      p.cubo(0.55, 0.82, 0.03, 0.35, 0.12, 0.06, "amarillo"); // pedales
      p.cubo(1.1, 0.82, 0.03, 0.35, 0.12, 0.06, "amarillo");
    },
  });

  // ==========================================================
  // AMPLIACIÓN 2 — cinco piezas más por categoría
  // ==========================================================

  // --- mesas ---

  def({
    id: "mesa_cristal", nombre: "Mesa de cristal", categoria: "mesas",
    precio: 130, tam: [1, 1], altura: 0.9,
    dibujar: function (p) {
      patas4(p, 0.08, 0.08, 0.92, 0.92, 0.08, 0.8, "gris");
      p.cubo(0, 0, 0.8, 1, 1, 0.08, "azul_claro");
      p.cubo(0.1, 0.1, 0.88, 0.24, 0.1, 0.015, "blanco"); // brillo
    },
  });

  def({
    id: "mesita_noche", nombre: "Mesita de noche", categoria: "mesas",
    precio: 55, tam: [1, 1], rotaciones: 4, altura: 0.7,
    dibujar: function (p) {
      p.cubo(0.1, 0.12, 0, 0.1, 0.1, 0.14, "madera_oscura"); // patas
      p.cubo(0.8, 0.12, 0, 0.1, 0.1, 0.14, "madera_oscura");
      p.cubo(0.1, 0.78, 0, 0.1, 0.1, 0.14, "madera_oscura");
      p.cubo(0.8, 0.78, 0, 0.1, 0.1, 0.14, "madera_oscura");
      p.cubo(0.06, 0.08, 0.14, 0.88, 0.84, 0.48, "madera");
      p.cubo(0.14, 0.9, 0.24, 0.72, 0.04, 0.28, "madera_oscura"); // cajón
      p.cilindro(0.5, 0.95, 0.38, 0.04, 0.04, "amarillo");        // pomo
      p.cubo(0, 0, 0.62, 1, 1, 0.08, "madera");
    },
  });

  def({
    id: "mesa_tv", nombre: "Mueble de tele", categoria: "mesas",
    precio: 120, tam: [2, 1], rotaciones: 4, altura: 0.55,
    dibujar: function (p) {
      p.cubo(0.05, 0.1, 0, 1.9, 0.8, 0.12, "madera_oscura");
      p.cubo(0.05, 0.1, 0.12, 0.14, 0.8, 0.3, "madera_oscura"); // laterales
      p.cubo(1.81, 0.1, 0.12, 0.14, 0.8, 0.3, "madera_oscura");
      p.cubo(0.9, 0.1, 0.12, 0.14, 0.8, 0.3, "madera_oscura");  // divisor
      p.cubo(0.3, 0.5, 0.16, 0.4, 0.3, 0.2, "gris_oscuro");     // cajas
      p.cubo(1.15, 0.5, 0.16, 0.5, 0.3, 0.14, "azul");
      p.cubo(0, 0.05, 0.42, 2, 0.9, 0.12, "madera");
    },
  });

  def({
    id: "mesa_picnic", nombre: "Mesa de pícnic", categoria: "mesas",
    precio: 210, tam: [2, 2], rotaciones: 2, altura: 0.85,
    dibujar: function (p) {
      p.cubo(0.3, 0.45, 0, 0.14, 0.14, 0.72, "madera_oscura"); // patas
      p.cubo(1.56, 0.45, 0, 0.14, 0.14, 0.72, "madera_oscura");
      p.cubo(0.3, 1.4, 0, 0.14, 0.14, 0.72, "madera_oscura");
      p.cubo(1.56, 1.4, 0, 0.14, 0.14, 0.72, "madera_oscura");
      p.cubo(0.1, 0.55, 0.72, 1.8, 0.9, 0.12, "madera");   // tablero
      p.cubo(0.15, 0.08, 0.36, 1.7, 0.3, 0.08, "madera");  // banco
      p.cubo(0.15, 1.62, 0.36, 1.7, 0.3, 0.08, "madera");  // banco
      p.cilindro(1.0, 1.0, 0.84, 0.12, 0.12, "rojo");      // cesta
    },
  });

  def({
    id: "mesa_dibujo", nombre: "Mesa de dibujo", categoria: "mesas",
    precio: 145, tam: [2, 1], rotaciones: 4, altura: 1.0,
    dibujar: function (p) {
      p.cubo(0.1, 0.12, 0, 0.12, 0.76, 0.8, "gris_oscuro"); // caballetes
      p.cubo(1.78, 0.12, 0, 0.12, 0.76, 0.8, "gris_oscuro");
      p.cubo(0.05, 0.05, 0.8, 1.9, 0.9, 0.1, "madera");
      p.cubo(0.35, 0.2, 0.9, 0.9, 0.6, 0.02, "blanco");    // plano
      p.cubo(0.5, 0.35, 0.92, 0.5, 0.06, 0.01, "azul");    // trazos
      p.cubo(0.5, 0.5, 0.92, 0.34, 0.06, 0.01, "rojo");
      p.cilindro(1.55, 0.35, 0.9, 0.06, 0.14, "gris");     // bote lápices
    },
  });

  // --- sillas ---

  def({
    id: "silla_playa", nombre: "Silla de playa", categoria: "sillas",
    precio: 60, tam: [1, 1], rotaciones: 4, altura: 1.0,
    sentable: "sentado", alturaAsiento: 0.35,
    dibujar: function (p) {
      p.cubo(0.15, 0.12, 0, 0.7, 0.08, 0.35, "madera");    // marco
      p.cubo(0.15, 0.8, 0, 0.7, 0.08, 0.35, "madera");
      p.cubo(0.2, 0.12, 0.3, 0.62, 0.76, 0.06, "rojo");    // tela asiento
      p.cubo(0.2, 0.3, 0.32, 0.62, 0.18, 0.06, "blanco");  // raya
      p.cubo(0.12, 0.12, 0.36, 0.12, 0.76, 0.55, "rojo");  // respaldo
      p.cubo(0.12, 0.36, 0.4, 0.11, 0.28, 0.51, "blanco");
    },
  });

  def({
    id: "trono", nombre: "Trono dorado", categoria: "sillas",
    precio: 950, tam: [1, 1], rotaciones: 4, altura: 1.9,
    sentable: "sentado", alturaAsiento: 0.6,
    dibujar: function (p) {
      p.cubo(0.05, 0.05, 0, 0.9, 0.9, 0.3, "amarillo");     // base
      p.cubo(0.1, 0.1, 0.3, 0.8, 0.8, 0.25, "rojo");        // asiento
      p.cubo(0.02, 0.05, 0.55, 0.16, 0.9, 1.25, "amarillo"); // respaldo
      p.cubo(0.14, 0.15, 0.7, 0.06, 0.7, 0.9, "rojo");      // tapizado
      p.cilindro(0.1, 0.1, 1.8, 0.08, 0.14, "amarillo");    // remates
      p.cilindro(0.1, 0.9, 1.8, 0.08, 0.14, "amarillo");
      p.cubo(0.2, 0.02, 0.55, 0.6, 0.12, 0.22, "amarillo"); // brazos
      p.cubo(0.2, 0.86, 0.55, 0.6, 0.12, 0.22, "amarillo");
    },
  });

  def({
    id: "puf_pera", nombre: "Puf pera", categoria: "sillas",
    precio: 65, tam: [1, 1], rotaciones: 4, altura: 0.7,
    sentable: "sentado", alturaAsiento: 0.32,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.42, 0.3, "rosa");
      p.cilindro(0.5, 0.5, 0.3, 0.32, 0.2, "rosa");
      p.cilindro(0.5, 0.5, 0.5, 0.18, 0.12, "morado");
    },
  });

  def({
    id: "banqueta_piano", nombre: "Banqueta de piano", categoria: "sillas",
    precio: 50, tam: [1, 1], rotaciones: 4, altura: 0.55,
    sentable: "sentado", alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0.2, 0.25, 0, 0.09, 0.09, 0.45, "negro");
      p.cubo(0.71, 0.25, 0, 0.09, 0.09, 0.45, "negro");
      p.cubo(0.2, 0.66, 0, 0.09, 0.09, 0.45, "negro");
      p.cubo(0.71, 0.66, 0, 0.09, 0.09, 0.45, "negro");
      p.cubo(0.12, 0.18, 0.45, 0.76, 0.64, 0.1, "negro");
      p.cubo(0.16, 0.22, 0.55, 0.68, 0.56, 0.06, "crema"); // acolchado
    },
  });

  def({
    id: "silla_gamer", nombre: "Silla gamer", categoria: "sillas",
    precio: 240, tam: [1, 1], rotaciones: 4, altura: 1.5,
    sentable: "sentado", alturaAsiento: 0.52,
    dibujar: function (p) {
      p.cubo(0.2, 0.44, 0, 0.6, 0.12, 0.06, "gris_oscuro"); // cruceta
      p.cubo(0.44, 0.2, 0, 0.12, 0.6, 0.06, "gris_oscuro");
      p.cilindro(0.5, 0.5, 0.06, 0.06, 0.34, "gris");       // pistón
      p.cubo(0.14, 0.14, 0.4, 0.72, 0.72, 0.14, "negro");   // asiento
      p.cubo(0.2, 0.2, 0.47, 0.6, 0.6, 0.08, "rojo");
      p.cubo(0.08, 0.1, 0.54, 0.14, 0.8, 0.95, "negro");    // respaldo
      p.cubo(0.2, 0.3, 0.6, 0.04, 0.4, 0.8, "rojo");        // franja
      p.cubo(0.3, 0.02, 0.72, 0.4, 0.1, 0.08, "negro");     // reposabrazos
      p.cubo(0.3, 0.88, 0.72, 0.4, 0.1, 0.08, "negro");
    },
  });

  // --- camas ---

  def({
    id: "cama_infantil", nombre: "Cama infantil", categoria: "camas",
    precio: 150, tam: [2, 1], rotaciones: 2, altura: 0.85,
    sentable: "tumbado", alturaAsiento: 0.4,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 0.12, 1, 0.8, "amarillo");           // cabecero
      p.cubo(0.12, 0, 0, 1.82, 1, 0.22, "amarillo");
      p.cubo(1.94, 0, 0, 0.06, 1, 0.5, "amarillo");        // piecero
      p.cubo(0.16, 0.04, 0.22, 1.76, 0.92, 0.16, "blanco");
      p.cubo(0.22, 0.16, 0.38, 0.4, 0.68, 0.1, "crema");   // almohada
      p.cubo(0.72, 0.02, 0.26, 1.2, 0.96, 0.16, "turquesa"); // manta
      p.cubo(0.2, 0.9, 0.38, 1.0, 0.08, 0.24, "amarillo"); // barandilla
    },
  });

  def({
    id: "futon", nombre: "Futón", categoria: "camas",
    precio: 110, tam: [2, 1], rotaciones: 2, altura: 0.5,
    sentable: "tumbado", alturaAsiento: 0.28,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 2, 1, 0.1, "madera_oscura");
      p.cubo(0.05, 0.04, 0.1, 1.9, 0.92, 0.16, "blanco");
      p.cubo(0.12, 0.14, 0.26, 0.38, 0.72, 0.1, "crema");  // almohada
      p.cubo(0.65, 0.02, 0.14, 1.28, 0.96, 0.14, "verde"); // manta
    },
  });

  def({
    id: "cama_dosel", nombre: "Cama con dosel", categoria: "camas",
    precio: 520, tam: [2, 2], rotaciones: 2, altura: 2.2,
    sentable: "tumbado", alturaAsiento: 0.46,
    dibujar: function (p) {
      p.cubo(0.02, 0.02, 0, 0.12, 0.12, 2.05, "madera_oscura"); // postes
      p.cubo(1.86, 0.02, 0, 0.12, 0.12, 2.05, "madera_oscura");
      p.cubo(0.02, 1.86, 0, 0.12, 0.12, 2.05, "madera_oscura");
      p.cubo(1.86, 1.86, 0, 0.12, 0.12, 2.05, "madera_oscura");
      p.cubo(0, 0, 0, 0.12, 2, 0.9, "madera_oscura");      // cabecero
      p.cubo(0.12, 0.05, 0, 1.82, 1.9, 0.25, "madera");
      p.cubo(0.16, 0.1, 0.25, 1.76, 1.8, 0.18, "blanco");
      p.cubo(0.24, 0.25, 0.43, 0.42, 0.6, 0.12, "crema");  // almohadas
      p.cubo(0.24, 1.15, 0.43, 0.42, 0.6, 0.12, "crema");
      p.cubo(0.8, 0.07, 0.3, 1.14, 1.86, 0.16, "rosa");    // manta
      p.cubo(0, 0, 2.05, 2, 2, 0.1, "rosa");               // techo de tela
    },
  });

  def({
    id: "saco_dormir", nombre: "Saco de dormir", categoria: "camas",
    precio: 40, tam: [2, 1], rotaciones: 2, altura: 0.3,
    sentable: "tumbado", alturaAsiento: 0.15,
    dibujar: function (p) {
      p.cubo(0.08, 0.2, 0, 1.84, 0.6, 0.16, "verde_oscuro");
      p.cubo(0.14, 0.26, 0.16, 0.5, 0.48, 0.05, "verde"); // abertura
      p.cubo(0.16, 0.3, 0.16, 0.34, 0.4, 0.09, "crema");  // almohadilla
    },
  });

  def({
    id: "cuna", nombre: "Cuna", categoria: "camas",
    precio: 130, tam: [1, 1], rotaciones: 4, altura: 0.95,
    dibujar: function (p) {
      p.cubo(0.1, 0.1, 0, 0.08, 0.08, 0.85, "madera");     // esquinas
      p.cubo(0.82, 0.1, 0, 0.08, 0.08, 0.85, "madera");
      p.cubo(0.1, 0.82, 0, 0.08, 0.08, 0.85, "madera");
      p.cubo(0.82, 0.82, 0, 0.08, 0.08, 0.85, "madera");
      p.cubo(0.12, 0.12, 0.25, 0.76, 0.76, 0.12, "blanco"); // colchón
      p.cubo(0.3, 0.3, 0.37, 0.4, 0.4, 0.08, "rosa");       // mantita
      p.cubo(0.1, 0.14, 0.55, 0.06, 0.72, 0.06, "madera");  // barrotes guía
      p.cubo(0.84, 0.14, 0.55, 0.06, 0.72, 0.06, "madera");
      p.cubo(0.1, 0.1, 0.78, 0.8, 0.06, 0.07, "madera");
      p.cubo(0.1, 0.84, 0.78, 0.8, 0.06, 0.07, "madera");
    },
  });

  // --- sofás ---

  def({
    id: "sofa_esquinero", nombre: "Sofá esquinero", categoria: "sofas",
    precio: 380, tam: [2, 2], rotaciones: 4, altura: 1.0,
    sentable: "sentado", alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 2, 0.9, 0.42, "turquesa");           // tramo largo
      p.cubo(0, 0.9, 0, 0.9, 1.1, 0.42, "turquesa");       // tramo corto
      p.cubo(0, 0, 0.42, 0.22, 2, 0.5, "turquesa");        // respaldo y
      p.cubo(0.22, 0, 0.42, 1.78, 0.2, 0.5, "turquesa");   // respaldo x
      p.cubo(0.3, 0.24, 0.42, 0.72, 0.6, 0.1, "crema");    // cojines
      p.cubo(1.1, 0.24, 0.42, 0.72, 0.6, 0.1, "crema");
      p.cubo(0.26, 0.95, 0.42, 0.6, 0.8, 0.1, "crema");
    },
  });

  def({
    id: "sofa_chester", nombre: "Sofá chester", categoria: "sofas",
    precio: 340, tam: [1, 2], rotaciones: 4, altura: 1.05,
    sentable: "sentado", alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0.05, 0.02, 0, 0.12, 0.12, 0.14, "madera_oscura"); // patas
      p.cubo(0.05, 1.86, 0, 0.12, 0.12, 0.14, "madera_oscura");
      p.cubo(0, 0, 0.14, 1, 2, 0.32, "marron");
      p.cubo(0, 0, 0.46, 0.24, 2, 0.55, "marron");         // respaldo
      p.cubo(0.24, 0, 0.46, 0.76, 0.16, 0.4, "marron");    // brazos
      p.cubo(0.24, 1.84, 0.46, 0.76, 0.16, 0.4, "marron");
      p.cubo(0.28, 0.2, 0.46, 0.64, 0.76, 0.1, "madera");  // cojines
      p.cubo(0.28, 1.04, 0.46, 0.64, 0.76, 0.1, "madera");
      p.cilindro(0.24, 0.5, 0.8, 0.03, 0.03, "amarillo");  // botones
      p.cilindro(0.24, 1.0, 0.8, 0.03, 0.03, "amarillo");
      p.cilindro(0.24, 1.5, 0.8, 0.03, 0.03, "amarillo");
    },
  });

  def({
    id: "sillon_orejero", nombre: "Sillón orejero", categoria: "sofas",
    precio: 180, tam: [1, 1], rotaciones: 4, altura: 1.45,
    sentable: "sentado", alturaAsiento: 0.5,
    dibujar: function (p) {
      p.cubo(0.1, 0.08, 0, 0.1, 0.1, 0.12, "madera_oscura");
      p.cubo(0.1, 0.82, 0, 0.1, 0.1, 0.12, "madera_oscura");
      p.cubo(0, 0, 0.12, 1, 1, 0.32, "azul");
      p.cubo(0, 0.02, 0.44, 0.24, 0.96, 0.95, "azul");     // respaldo alto
      p.cubo(0.1, 0, 1.1, 0.22, 0.2, 0.3, "azul");         // orejas
      p.cubo(0.1, 0.8, 1.1, 0.22, 0.2, 0.3, "azul");
      p.cubo(0.24, 0, 0.44, 0.72, 0.16, 0.34, "azul");     // brazos
      p.cubo(0.24, 0.84, 0.44, 0.72, 0.16, 0.34, "azul");
      p.cubo(0.28, 0.2, 0.44, 0.64, 0.6, 0.1, "azul_claro"); // cojín
    },
  });

  def({
    id: "banco_acolchado", nombre: "Banco acolchado", categoria: "sofas",
    precio: 120, tam: [1, 2], rotaciones: 4, altura: 0.55,
    sentable: "sentado", alturaAsiento: 0.45,
    dibujar: function (p) {
      p.cubo(0.15, 0.1, 0, 0.12, 0.12, 0.3, "madera_oscura");
      p.cubo(0.73, 0.1, 0, 0.12, 0.12, 0.3, "madera_oscura");
      p.cubo(0.15, 1.78, 0, 0.12, 0.12, 0.3, "madera_oscura");
      p.cubo(0.73, 1.78, 0, 0.12, 0.12, 0.3, "madera_oscura");
      p.cubo(0.05, 0.02, 0.3, 0.9, 1.96, 0.12, "rosa");
      p.cubo(0.1, 0.08, 0.42, 0.8, 0.84, 0.08, "rosa");    // acolchado
      p.cubo(0.1, 1.04, 0.42, 0.8, 0.84, 0.08, "rosa");
    },
  });

  def({
    id: "divan", nombre: "Diván", categoria: "sofas",
    precio: 290, tam: [2, 1], rotaciones: 2, altura: 0.95,
    sentable: "tumbado", alturaAsiento: 0.42,
    dibujar: function (p) {
      p.cubo(0.08, 0.1, 0, 0.1, 0.1, 0.16, "amarillo");    // patas
      p.cubo(1.8, 0.1, 0, 0.1, 0.1, 0.16, "amarillo");
      p.cubo(0.08, 0.8, 0, 0.1, 0.1, 0.16, "amarillo");
      p.cubo(1.8, 0.8, 0, 0.1, 0.1, 0.16, "amarillo");
      p.cubo(0, 0, 0.16, 2, 1, 0.26, "rojo");
      p.cubo(0, 0, 0.42, 0.3, 1, 0.4, "rojo");             // cabecera curvada
      p.cubo(0.3, 0, 0.42, 0.14, 1, 0.2, "rojo");
      p.cubo(0.34, 0.2, 0.42, 0.4, 0.6, 0.1, "naranja");   // cojín
    },
  });

  // --- alfombras ---

  alfombra("alfombra_morada", "Alfombra morada", 70, [2, 2], [
    [0, 0, 2, 2, "morado"],
    [0.18, 0.18, 1.64, 1.64, "rosa"],
    [0.5, 0.5, 1.0, 1.0, "morado"],
  ]);

  alfombra("alfombra_camino", "Alfombra de pasillo", 60, [3, 1], [
    [0, 0, 3, 1, "rojo"],
    [0.1, 0.1, 0.25, 0.8, "amarillo"],
    [2.65, 0.1, 0.25, 0.8, "amarillo"],
    [0.55, 0.15, 1.9, 0.7, "naranja"],
  ]);

  alfombra("alfombra_ajedrez", "Alfombra de ajedrez", 90, [2, 2], [
    [0, 0, 2, 2, "negro"],
    [0.5, 0, 0.5, 0.5, "blanco"],
    [1.5, 0, 0.5, 0.5, "blanco"],
    [0, 0.5, 0.5, 0.5, "blanco"],
    [1, 0.5, 0.5, 0.5, "blanco"],
    [0.5, 1, 0.5, 0.5, "blanco"],
    [1.5, 1, 0.5, 0.5, "blanco"],
    [0, 1.5, 0.5, 0.5, "blanco"],
    [1, 1.5, 0.5, 0.5, "blanco"],
  ]);

  alfombra("alfombra_arcoiris", "Alfombra arcoíris", 95, [2, 2], [
    [0, 0, 2, 0.5, "rojo"],
    [0, 0.5, 2, 0.5, "amarillo"],
    [0, 1, 2, 0.5, "verde"],
    [0, 1.5, 2, 0.5, "azul"],
  ]);

  alfombra("alfombra_infantil", "Alfombra infantil", 65, [2, 2], [
    [0, 0, 2, 2, "azul_claro"],
    [0.55, 0.55, 0.9, 0.9, "amarillo"],
    [0.12, 0.12, 0.3, 0.3, "rojo"],
    [1.58, 0.12, 0.3, 0.3, "verde"],
    [0.12, 1.58, 0.3, 0.3, "rosa"],
    [1.58, 1.58, 0.3, 0.3, "naranja"],
  ]);

  // --- plantas ---

  def({
    id: "rosal", nombre: "Rosal en maceta", categoria: "plantas",
    precio: 55, tam: [1, 1], altura: 1.0,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.26, "naranja");
      p.cubo(0.24, 0.24, 0.26, 0.52, 0.52, 0.4, "verde_oscuro"); // mata
      p.cubo(0.3, 0.3, 0.66, 0.4, 0.4, 0.14, "verde");
      p.cilindro(0.32, 0.38, 0.74, 0.07, 0.1, "rojo");     // rosas
      p.cilindro(0.62, 0.32, 0.78, 0.07, 0.1, "rojo");
      p.cilindro(0.52, 0.62, 0.72, 0.07, 0.1, "rosa");
    },
  });

  def({
    id: "lavanda", nombre: "Lavanda", categoria: "plantas",
    precio: 40, tam: [1, 1], altura: 0.95,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.22, 0.24, "gris");
      p.cilindro(0.36, 0.42, 0.24, 0.025, 0.4, "verde");   // tallos
      p.cilindro(0.55, 0.36, 0.24, 0.025, 0.48, "verde");
      p.cilindro(0.62, 0.58, 0.24, 0.025, 0.36, "verde");
      p.cilindro(0.36, 0.42, 0.64, 0.045, 0.18, "morado"); // espigas
      p.cilindro(0.55, 0.36, 0.72, 0.045, 0.18, "morado");
      p.cilindro(0.62, 0.58, 0.6, 0.045, 0.18, "morado");
    },
  });

  def({
    id: "hiedra", nombre: "Hiedra en pedestal", categoria: "plantas",
    precio: 70, tam: [1, 1], altura: 1.3,
    dibujar: function (p) {
      p.cubo(0.3, 0.3, 0, 0.4, 0.4, 0.75, "crema");        // pedestal
      p.cilindro(0.5, 0.5, 0.75, 0.2, 0.18, "madera");     // maceta
      p.cubo(0.3, 0.3, 0.93, 0.4, 0.4, 0.18, "verde");     // mata
      p.cubo(0.62, 0.42, 0.55, 0.14, 0.14, 0.4, "verde");  // guías colgando
      p.cubo(0.42, 0.64, 0.35, 0.12, 0.12, 0.6, "verde_oscuro");
      p.cubo(0.68, 0.6, 0.75, 0.12, 0.12, 0.2, "verde_oscuro");
    },
  });

  def({
    id: "limonero", nombre: "Limonero", categoria: "plantas",
    precio: 140, tam: [1, 1], altura: 1.9,
    bloquea: true,
    dibujar: function (p) {
      p.cubo(0.22, 0.22, 0, 0.56, 0.56, 0.3, "madera_oscura"); // maceta
      p.cilindro(0.5, 0.5, 0.3, 0.07, 0.6, "madera");
      p.cubo(0.16, 0.16, 0.9, 0.68, 0.68, 0.55, "verde");  // copa
      p.cubo(0.28, 0.28, 1.45, 0.44, 0.44, 0.22, "verde_oscuro");
      p.cilindro(0.3, 0.4, 1.1, 0.06, 0.1, "amarillo");    // limones
      p.cilindro(0.66, 0.3, 1.25, 0.06, 0.1, "amarillo");
      p.cilindro(0.55, 0.68, 1.0, 0.06, 0.1, "amarillo");
    },
  });

  def({
    id: "planta_carnivora", nombre: "Planta carnívora", categoria: "plantas",
    precio: 85, tam: [1, 1], altura: 1.1,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.26, "morado");
      p.cilindro(0.5, 0.5, 0.26, 0.05, 0.45, "verde_oscuro"); // tallo
      p.cubo(0.32, 0.34, 0.71, 0.36, 0.32, 0.18, "rojo");  // boca abajo
      p.cubo(0.32, 0.34, 0.97, 0.36, 0.32, 0.14, "rojo");  // boca arriba
      p.cubo(0.6, 0.38, 0.89, 0.07, 0.06, 0.08, "blanco"); // dientes
      p.cubo(0.6, 0.54, 0.89, 0.07, 0.06, 0.08, "blanco");
      p.cubo(0.26, 0.6, 0.3, 0.16, 0.16, 0.1, "verde");    // hojas base
      p.cubo(0.6, 0.24, 0.3, 0.16, 0.16, 0.1, "verde");
    },
  });

  // --- piscinas ---

  def({
    id: "flotador", nombre: "Flotador dónut", categoria: "piscinas",
    precio: 45, tam: [1, 1], altura: 0.25,
    bloquea: false,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.4, 0.2, "rosa");
      p.cilindro(0.5, 0.5, 0.2, 0.18, 0.02, "azul_claro"); // agujero
      p.cubo(0.14, 0.42, 0.14, 0.14, 0.16, 0.08, "blanco"); // topping
      p.cubo(0.62, 0.24, 0.16, 0.14, 0.16, 0.07, "blanco");
    },
  });

  def({
    id: "sombrilla", nombre: "Sombrilla", categoria: "piscinas",
    precio: 110, tam: [1, 1], altura: 2.1,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.1, "gris");          // base
      p.cilindro(0.5, 0.5, 0.1, 0.045, 1.45, "madera");    // mástil
      p.cilindro(0.5, 0.5, 1.4, 0.62, 0.14, "rojo");       // copa
      p.cilindro(0.5, 0.5, 1.54, 0.46, 0.12, "blanco");
      p.cilindro(0.5, 0.5, 1.66, 0.3, 0.12, "rojo");
      p.cilindro(0.5, 0.5, 1.78, 0.1, 0.14, "blanco");     // remate
    },
  });

  def({
    id: "ducha_piscina", nombre: "Ducha de piscina", categoria: "piscinas",
    precio: 130, tam: [1, 1], altura: 2.1,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.4, 0.08, "azul_claro");    // plato
      p.cilindro(0.62, 0.5, 0.08, 0.05, 1.8, "gris");      // poste
      p.cubo(0.3, 0.46, 1.82, 0.38, 0.08, 0.07, "gris");   // brazo
      p.cilindro(0.34, 0.5, 1.72, 0.11, 0.08, "gris");     // alcachofa
      p.cilindro(0.34, 0.5, 0.2, 0.035, 1.52, "azul_claro"); // chorro
    },
  });

  def({
    id: "trampolin", nombre: "Trampolín", categoria: "piscinas",
    precio: 160, tam: [1, 1], rotaciones: 4, altura: 0.85,
    dibujar: function (p) {
      p.cubo(0.1, 0.3, 0, 0.25, 0.4, 0.6, "gris");        // soporte
      p.cubo(0.05, 0.35, 0.6, 0.9, 0.3, 0.1, "azul");     // tabla
      p.cubo(0.75, 0.38, 0.7, 0.16, 0.24, 0.02, "blanco"); // punta
    },
  });

  def({
    id: "silla_socorrista", nombre: "Silla de socorrista", categoria: "piscinas",
    precio: 280, tam: [1, 1], rotaciones: 4, altura: 1.9,
    sentable: "sentado", alturaAsiento: 0.95,
    dibujar: function (p) {
      p.cubo(0.12, 0.12, 0, 0.1, 0.1, 0.95, "blanco");     // patas
      p.cubo(0.78, 0.12, 0, 0.1, 0.1, 0.95, "blanco");
      p.cubo(0.12, 0.78, 0, 0.1, 0.1, 0.95, "blanco");
      p.cubo(0.78, 0.78, 0, 0.1, 0.1, 0.95, "blanco");
      p.cubo(0.1, 0.1, 0.95, 0.8, 0.8, 0.1, "madera");     // plataforma
      p.cubo(0.1, 0.12, 1.05, 0.12, 0.76, 0.6, "blanco");  // respaldo
      p.cubo(0.16, 0.3, 1.2, 0.05, 0.4, 0.3, "rojo");      // cruz roja
      p.cubo(0.5, 0.85, 0.2, 0.14, 0.06, 0.75, "madera");  // escalera
      p.cubo(0.36, 0.85, 0.35, 0.42, 0.05, 0.06, "madera");
      p.cubo(0.36, 0.85, 0.65, 0.42, 0.05, 0.06, "madera");
    },
  });

  // --- almacenaje ---

  def({
    id: "zapatero", nombre: "Zapatero", categoria: "almacenaje",
    precio: 95, tam: [1, 1], rotaciones: 4, altura: 0.95,
    dibujar: function (p) {
      p.cubo(0.08, 0.15, 0, 0.84, 0.7, 0.85, "crema");
      p.cubo(0.08, 0.86, 0.12, 0.84, 0.05, 0.05, "madera"); // listones
      p.cubo(0.08, 0.86, 0.42, 0.84, 0.05, 0.05, "madera");
      p.cubo(0.2, 0.88, 0.18, 0.2, 0.1, 0.1, "rojo");       // zapatos
      p.cubo(0.55, 0.88, 0.18, 0.2, 0.1, 0.1, "azul");
      p.cubo(0.35, 0.88, 0.48, 0.2, 0.1, 0.1, "verde");
      p.cubo(0.05, 0.12, 0.85, 0.9, 0.76, 0.08, "madera");  // tapa
    },
  });

  def({
    id: "perchero", nombre: "Perchero de pie", categoria: "almacenaje",
    precio: 60, tam: [1, 1], altura: 1.9,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.26, 0.06, "madera_oscura");
      p.cilindro(0.5, 0.5, 0.06, 0.05, 1.7, "madera");
      p.cubo(0.28, 0.46, 1.6, 0.5, 0.08, 0.07, "madera_oscura"); // brazos
      p.cubo(0.46, 0.28, 1.68, 0.08, 0.5, 0.07, "madera_oscura");
      p.cubo(0.6, 0.42, 1.05, 0.26, 0.18, 0.55, "rojo");   // abrigo
      p.cilindro(0.5, 0.5, 1.76, 0.14, 0.1, "verde");      // sombrero
    },
  });

  def({
    id: "archivador", nombre: "Archivador metálico", categoria: "almacenaje",
    precio: 110, tam: [1, 1], rotaciones: 4, altura: 1.3,
    dibujar: function (p) {
      p.cubo(0.15, 0.15, 0, 0.7, 0.7, 1.2, "gris");
      p.cubo(0.86, 0.2, 0.15, 0.04, 0.6, 0.28, "gris_oscuro"); // cajones
      p.cubo(0.86, 0.2, 0.5, 0.04, 0.6, 0.28, "gris_oscuro");
      p.cubo(0.86, 0.2, 0.85, 0.04, 0.6, 0.28, "gris_oscuro");
      p.cubo(0.88, 0.42, 0.26, 0.04, 0.16, 0.04, "blanco");    // tiradores
      p.cubo(0.88, 0.42, 0.61, 0.04, 0.16, 0.04, "blanco");
      p.cubo(0.88, 0.42, 0.96, 0.04, 0.16, 0.04, "blanco");
    },
  });

  def({
    id: "cesto_ropa", nombre: "Cesto de ropa", categoria: "almacenaje",
    precio: 45, tam: [1, 1], altura: 0.75,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.3, 0.55, "beige");
      p.cilindro(0.5, 0.5, 0.55, 0.32, 0.06, "madera");    // borde
      p.cubo(0.32, 0.36, 0.61, 0.22, 0.2, 0.1, "rosa");    // ropa asomando
      p.cubo(0.52, 0.42, 0.61, 0.2, 0.18, 0.07, "azul_claro");
    },
  });

  def({
    id: "botellero", nombre: "Botellero", categoria: "almacenaje",
    precio: 105, tam: [1, 1], rotaciones: 4, altura: 1.1,
    dibujar: function (p) {
      p.cubo(0.2, 0.15, 0, 0.6, 0.7, 0.1, "madera_oscura");
      p.cubo(0.2, 0.15, 0.1, 0.08, 0.7, 0.9, "madera_oscura"); // laterales
      p.cubo(0.72, 0.15, 0.1, 0.08, 0.7, 0.9, "madera_oscura");
      p.cubo(0.28, 0.15, 0.5, 0.44, 0.7, 0.07, "madera");      // balda
      p.cilindro(0.4, 0.5, 0.12, 0.07, 0.36, "verde");     // botellas
      p.cilindro(0.58, 0.5, 0.12, 0.07, 0.36, "verde_oscuro");
      p.cilindro(0.4, 0.5, 0.59, 0.07, 0.36, "azul");
      p.cilindro(0.58, 0.5, 0.59, 0.07, 0.36, "rojo");
    },
  });

  // --- electro ---

  def({
    id: "microondas", nombre: "Microondas", categoria: "electro",
    precio: 95, tam: [1, 1], rotaciones: 4, altura: 0.95,
    dibujar: function (p) {
      p.cubo(0.15, 0.15, 0, 0.7, 0.7, 0.55, "madera");     // mueblecito
      p.cubo(0.1, 0.1, 0.55, 0.8, 0.8, 0.06, "madera_oscura");
      p.cubo(0.18, 0.2, 0.61, 0.64, 0.6, 0.32, "blanco");  // micro
      p.cubo(0.82, 0.26, 0.65, 0.03, 0.36, 0.24, "negro"); // puerta
      p.cubo(0.82, 0.66, 0.68, 0.03, 0.08, 0.18, "gris");  // panel
    },
  });

  def({
    id: "tele_grande", nombre: "Tele de cine", categoria: "electro",
    precio: 420, tam: [2, 1], rotaciones: 4, altura: 1.5,
    luz: { x: 1, y: 0.5, z: 0.9, radio: 46, color: [147, 186, 219] },
    dibujar: function (p) {
      p.cubo(0.3, 0.3, 0, 1.4, 0.4, 0.16, "gris_oscuro");  // peana
      p.cubo(0.9, 0.4, 0.16, 0.2, 0.2, 0.2, "gris_oscuro");
      p.cubo(0.1, 0.4, 0.36, 1.8, 0.14, 1.05, "negro");    // tele
      p.cubo(0.18, 0.54, 0.44, 1.64, 0.03, 0.89, "azul_claro"); // pantalla
      p.cubo(0.4, 0.57, 0.65, 0.5, 0.015, 0.4, "blanco");  // brillo
    },
  });

  def({
    id: "robot_aspirador", nombre: "Robot aspirador", categoria: "electro",
    precio: 150, tam: [1, 1], altura: 0.14,
    bloquea: false,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.34, 0.1, "gris_oscuro");
      p.cilindro(0.5, 0.5, 0.1, 0.08, 0.03, "turquesa");   // botón
      p.cubo(0.7, 0.44, 0.04, 0.1, 0.12, 0.04, "negro");   // sensor
    },
  });

  def({
    id: "consola_juegos", nombre: "Consola de juegos", categoria: "electro",
    precio: 260, tam: [1, 1], rotaciones: 4, altura: 0.45,
    dibujar: function (p) {
      p.cubo(0.15, 0.25, 0, 0.6, 0.5, 0.14, "negro");      // consola
      p.cubo(0.32, 0.3, 0.14, 0.26, 0.4, 0.02, "turquesa"); // luz
      p.cubo(0.55, 0.66, 0.02, 0.24, 0.18, 0.08, "gris_oscuro"); // mando
      p.cilindro(0.6, 0.72, 0.1, 0.03, 0.03, "rojo");
      p.cilindro(0.73, 0.72, 0.1, 0.03, 0.03, "amarillo");
    },
  });

  def({
    id: "maquina_refrescos", nombre: "Máquina de refrescos", categoria: "electro",
    precio: 380, tam: [1, 1], rotaciones: 4, altura: 1.9,
    luz: { x: 0.5, y: 0.5, z: 1.2, radio: 34, color: [201, 83, 73] },
    dibujar: function (p) {
      p.cubo(0.12, 0.12, 0, 0.76, 0.76, 1.8, "rojo");
      p.cubo(0.88, 0.2, 0.75, 0.04, 0.6, 0.95, "blanco");  // panel
      p.cubo(0.9, 0.28, 0.9, 0.04, 0.14, 0.3, "naranja");  // latas
      p.cubo(0.9, 0.48, 0.9, 0.04, 0.14, 0.3, "turquesa");
      p.cubo(0.9, 0.28, 1.3, 0.04, 0.14, 0.3, "morado");
      p.cubo(0.9, 0.5, 0.3, 0.04, 0.24, 0.18, "negro");    // ranura
    },
  });

  // --- iluminación ---

  def({
    id: "lampara_arco", nombre: "Lámpara de arco", categoria: "iluminacion",
    precio: 160, tam: [1, 1], altura: 1.9,
    luz: { x: 0.72, y: 0.5, z: 1.5, radio: 42, color: [242, 239, 230] },
    dibujar: function (p) {
      p.cilindro(0.25, 0.5, 0, 0.22, 0.12, "blanco");      // base mármol
      p.cubo(0.2, 0.47, 0.12, 0.08, 0.06, 1.3, "gris");    // subida
      p.cubo(0.2, 0.47, 1.42, 0.45, 0.06, 0.07, "gris");   // arco
      p.cubo(0.6, 0.47, 1.28, 0.07, 0.06, 0.2, "gris");
      p.cilindro(0.72, 0.5, 1.15, 0.14, 0.14, "gris");     // pantalla
      p.cilindro(0.72, 0.5, 1.1, 0.09, 0.05, "amarillo");  // bombilla
    },
  });

  def({
    id: "lampara_papel", nombre: "Lámpara de papel", categoria: "iluminacion",
    precio: 85, tam: [1, 1], altura: 1.45,
    luz: { x: 0.5, y: 0.5, z: 0.9, radio: 40, color: [232, 220, 190] },
    dibujar: function (p) {
      p.cubo(0.34, 0.34, 0, 0.32, 0.32, 0.06, "madera_oscura");
      p.cilindro(0.5, 0.5, 0.06, 0.035, 0.4, "madera");
      p.cilindro(0.5, 0.5, 0.46, 0.3, 0.75, "crema");      // globo
      p.cilindro(0.5, 0.5, 1.21, 0.12, 0.06, "madera");
    },
  });

  def({
    id: "neon_flamenco", nombre: "Flamenco de neón", categoria: "iluminacion",
    precio: 190, tam: [1, 1], altura: 1.5,
    luz: { x: 0.5, y: 0.5, z: 0.9, radio: 44, color: [216, 146, 171] },
    dibujar: function (p) {
      p.cubo(0.25, 0.25, 0, 0.5, 0.5, 0.08, "negro");      // base
      p.cilindro(0.45, 0.5, 0.08, 0.025, 0.55, "rosa");    // patas
      p.cilindro(0.58, 0.5, 0.08, 0.025, 0.4, "rosa");
      p.cilindro(0.5, 0.5, 0.6, 0.2, 0.3, "rosa");         // cuerpo
      p.cilindro(0.35, 0.5, 0.85, 0.05, 0.42, "rosa");     // cuello
      p.cilindro(0.35, 0.5, 1.27, 0.09, 0.12, "rosa");     // cabeza
      p.cubo(0.24, 0.47, 1.28, 0.1, 0.06, 0.06, "naranja"); // pico
    },
  });

  def({
    id: "flexo", nombre: "Flexo de estudio", categoria: "iluminacion",
    precio: 55, tam: [1, 1], altura: 0.85,
    luz: { x: 0.6, y: 0.5, z: 0.55, radio: 26, color: [228, 194, 90] },
    dibujar: function (p) {
      p.cilindro(0.4, 0.5, 0, 0.18, 0.06, "negro");
      p.cubo(0.38, 0.48, 0.06, 0.05, 0.05, 0.45, "negro"); // brazo
      p.cubo(0.4, 0.48, 0.5, 0.25, 0.05, 0.05, "negro");
      p.cilindro(0.62, 0.5, 0.42, 0.1, 0.14, "amarillo");  // cabezal
    },
  });

  def({
    id: "antorcha", nombre: "Antorcha de jardín", categoria: "iluminacion",
    precio: 75, tam: [1, 1], altura: 1.6,
    luz: { x: 0.5, y: 0.5, z: 1.45, radio: 38, color: [224, 143, 69] },
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.14, 0.1, "gris_oscuro");
      p.cilindro(0.5, 0.5, 0.1, 0.045, 1.1, "madera_oscura");
      p.cilindro(0.5, 0.5, 1.2, 0.11, 0.16, "gris_oscuro"); // cuenco
      p.cilindro(0.5, 0.5, 1.36, 0.07, 0.14, "naranja");    // llama
      p.cilindro(0.5, 0.5, 1.5, 0.04, 0.09, "amarillo");
    },
  });

  // --- pared ---

  cuadro("trofeo_ciervo", "Ciervo de madera", 140, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.26, 1.08, 0.48, 0.5, 0.04, "madera_oscura"); // placa
    pieza(ctx, pa, u + 0.36, 1.18, 0.28, 0.3, 0.09, "madera");        // cabeza
    pieza(ctx, pa, u + 0.42, 1.1, 0.16, 0.12, 0.12, "madera");        // hocico
    pieza(ctx, pa, u + 0.28, 1.48, 0.08, 0.26, 0.07, "beige");        // cuernos
    pieza(ctx, pa, u + 0.64, 1.48, 0.08, 0.26, 0.07, "beige");
    pieza(ctx, pa, u + 0.2, 1.62, 0.24, 0.07, 0.07, "beige");
    pieza(ctx, pa, u + 0.56, 1.62, 0.24, 0.07, 0.07, "beige");
  });

  cuadro("cuadro_gato", "Cuadro: gato", 75, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.12, 1.06, 0.76, 0.72, 0.045, "madera");     // marco
    pieza(ctx, pa, u + 0.17, 1.11, 0.66, 0.62, 0.06, "azul_claro");  // fondo
    pieza(ctx, pa, u + 0.34, 1.2, 0.32, 0.3, 0.07, "negro");         // cara
    pieza(ctx, pa, u + 0.36, 1.48, 0.09, 0.12, 0.07, "negro");       // orejas
    pieza(ctx, pa, u + 0.55, 1.48, 0.09, 0.12, 0.07, "negro");
    pieza(ctx, pa, u + 0.4, 1.34, 0.06, 0.06, 0.08, "amarillo");     // ojos
    pieza(ctx, pa, u + 0.54, 1.34, 0.06, 0.06, 0.08, "amarillo");
  });

  cuadro("banderin", "Banderín", 45, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.14, 1.55, 0.72, 0.14, 0.05, "azul");
    pieza(ctx, pa, u + 0.24, 1.4, 0.52, 0.15, 0.055, "azul");
    pieza(ctx, pa, u + 0.34, 1.25, 0.32, 0.15, 0.06, "azul");
    pieza(ctx, pa, u + 0.42, 1.12, 0.16, 0.13, 0.065, "azul");
    pieza(ctx, pa, u + 0.2, 1.58, 0.6, 0.07, 0.07, "amarillo"); // franja
  });

  cuadro("mapa_mundo", "Mapa del mundo", 130, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.06, 1.04, 0.88, 0.72, 0.04, "madera_oscura");
    pieza(ctx, pa, u + 0.1, 1.08, 0.8, 0.64, 0.055, "azul");
    pieza(ctx, pa, u + 0.15, 1.38, 0.22, 0.24, 0.065, "verde");      // continentes
    pieza(ctx, pa, u + 0.24, 1.16, 0.14, 0.2, 0.065, "verde");
    pieza(ctx, pa, u + 0.48, 1.42, 0.2, 0.16, 0.065, "verde");
    pieza(ctx, pa, u + 0.52, 1.14, 0.12, 0.24, 0.065, "verde");
    pieza(ctx, pa, u + 0.72, 1.2, 0.12, 0.14, 0.065, "verde");
  });

  cuadro("guitarra_pared", "Guitarra colgada", 165, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.34, 1.05, 0.32, 0.3, 0.07, "naranja");      // cuerpo
    pieza(ctx, pa, u + 0.38, 1.28, 0.24, 0.18, 0.075, "naranja");
    pieza(ctx, pa, u + 0.44, 1.16, 0.12, 0.12, 0.08, "negro");       // boca
    pieza(ctx, pa, u + 0.465, 1.44, 0.07, 0.32, 0.075, "madera_oscura"); // mástil
    pieza(ctx, pa, u + 0.44, 1.74, 0.12, 0.1, 0.08, "negro");        // clavijero
  });

  // --- jardín ---

  def({
    id: "arenero", nombre: "Arenero", categoria: "jardin",
    precio: 120, tam: [2, 2], altura: 0.35,
    dibujar: function (p) {
      p.cubo(0, 0, 0, 2, 0.16, 0.28, "madera");            // marco
      p.cubo(0, 1.84, 0, 2, 0.16, 0.28, "madera");
      p.cubo(0, 0.16, 0, 0.16, 1.68, 0.28, "madera");
      p.cubo(1.84, 0.16, 0, 0.16, 1.68, 0.28, "madera");
      p.cubo(0.16, 0.16, 0, 1.68, 1.68, 0.2, "beige");     // arena
      p.cubo(0.5, 0.5, 0.2, 0.26, 0.26, 0.2, "rojo");      // cubo de juguete
      p.cubo(1.2, 1.1, 0.2, 0.3, 0.08, 0.05, "azul");      // pala
      p.cilindro(1.4, 0.6, 0.2, 0.12, 0.08, "amarillo");   // flanecito
    },
  });

  def({
    id: "casita_pajaros", nombre: "Casita de pájaros", categoria: "jardin",
    precio: 70, tam: [1, 1], altura: 1.65,
    dibujar: function (p) {
      p.cubo(0.44, 0.44, 0, 0.12, 0.12, 1.0, "madera_oscura"); // poste
      p.cubo(0.28, 0.3, 1.0, 0.44, 0.4, 0.36, "madera");   // casita
      p.cubo(0.24, 0.26, 1.36, 0.52, 0.48, 0.1, "rojo");   // techo
      p.cubo(0.3, 0.32, 1.46, 0.4, 0.36, 0.08, "rojo");
      p.cilindro(0.62, 0.5, 1.12, 0.06, 0.06, "negro");    // agujero
      p.cubo(0.68, 0.47, 1.05, 0.1, 0.06, 0.03, "madera"); // palito
    },
  });

  def({
    id: "carretilla", nombre: "Carretilla", categoria: "jardin",
    precio: 90, tam: [2, 1], rotaciones: 4, altura: 0.7,
    dibujar: function (p) {
      p.cubo(1.5, 0.38, 0.1, 0.3, 0.24, 0.3, "negro");     // rueda
      p.cubo(0.2, 0.2, 0.28, 1.3, 0.6, 0.3, "naranja");    // cuba
      p.cubo(0.28, 0.28, 0.58, 1.14, 0.44, 0.1, "marron"); // tierra
      p.cubo(0.05, 0.26, 0, 0.08, 0.08, 0.32, "gris");     // patas
      p.cubo(0.05, 0.66, 0, 0.08, 0.08, 0.32, "gris");
      p.cubo(0.05, 0.26, 0.32, 0.2, 0.06, 0.06, "madera"); // mangos
      p.cubo(0.05, 0.68, 0.32, 0.2, 0.06, 0.06, "madera");
    },
  });

  def({
    id: "pozo", nombre: "Pozo de los deseos", categoria: "jardin",
    precio: 310, tam: [1, 1], altura: 1.8,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.42, 0.5, "gris");          // cuerpo
      p.cilindro(0.5, 0.5, 0.5, 0.34, 0.05, "turquesa");   // agua
      p.cubo(0.08, 0.44, 0.5, 0.1, 0.12, 0.85, "madera");  // postes
      p.cubo(0.82, 0.44, 0.5, 0.1, 0.12, 0.85, "madera");
      p.cubo(0.02, 0.36, 1.35, 0.96, 0.28, 0.1, "rojo");   // tejadillo
      p.cubo(0.14, 0.42, 1.45, 0.72, 0.16, 0.09, "rojo");
      p.cilindro(0.5, 0.5, 1.02, 0.035, 0.33, "madera_oscura"); // cuerda
      p.cubo(0.42, 0.42, 0.86, 0.16, 0.16, 0.16, "gris_oscuro"); // cubo
    },
  });

  def({
    id: "valla_blanca", nombre: "Valla blanca", categoria: "jardin",
    precio: 35, tam: [1, 1], rotaciones: 2, altura: 0.85,
    dibujar: function (p) {
      p.cubo(0.08, 0.44, 0, 0.12, 0.12, 0.8, "blanco");    // postes
      p.cubo(0.8, 0.44, 0, 0.12, 0.12, 0.8, "blanco");
      p.cubo(0.44, 0.44, 0, 0.12, 0.12, 0.7, "blanco");
      p.cubo(0, 0.46, 0.25, 1, 0.08, 0.1, "blanco");       // travesaños
      p.cubo(0, 0.46, 0.55, 1, 0.08, 0.1, "blanco");
    },
  });

  // --- fiesta ---

  def({
    id: "tarima_gogo", nombre: "Tarima gogó", categoria: "baile",
    precio: 230, tam: [1, 1], altura: 1.9,
    luz: { x: 0.5, y: 0.5, z: 0.5, radio: 34, color: [216, 146, 171] },
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.4, 0.35, "gris_oscuro");   // tarima
      p.cilindro(0.5, 0.5, 0.35, 0.36, 0.06, "rosa");      // top brillante
      p.cilindro(0.5, 0.5, 0.41, 0.045, 1.4, "amarillo");  // barra
      p.cilindro(0.5, 0.5, 1.81, 0.08, 0.05, "amarillo");
    },
  });

  def({
    id: "maquina_humo", nombre: "Máquina de humo", categoria: "baile",
    precio: 170, tam: [1, 1], rotaciones: 4, altura: 0.75,
    dibujar: function (p) {
      p.cubo(0.15, 0.25, 0, 0.55, 0.5, 0.3, "gris_oscuro");
      p.cubo(0.7, 0.4, 0.08, 0.12, 0.2, 0.14, "negro");    // boquilla
      p.cilindro(0.88, 0.5, 0.05, 0.13, 0.18, "gris");     // nube
      p.cilindro(1.0, 0.5, 0.12, 0.16, 0.22, "blanco");
      p.cubo(0.25, 0.3, 0.3, 0.1, 0.1, 0.04, "rojo");      // botones
      p.cubo(0.4, 0.3, 0.3, 0.1, 0.1, 0.04, "verde");
    },
  });

  cuadro("letrero_copa", "Neón: copa", 135, false, function (ctx, pa, u) {
    pieza(ctx, pa, u + 0.16, 1.1, 0.68, 0.66, 0.04, "negro");        // panel
    pieza(ctx, pa, u + 0.28, 1.5, 0.44, 0.08, 0.06, "turquesa");     // copa arriba
    pieza(ctx, pa, u + 0.36, 1.4, 0.28, 0.1, 0.06, "turquesa");
    pieza(ctx, pa, u + 0.44, 1.3, 0.12, 0.1, 0.065, "turquesa");
    pieza(ctx, pa, u + 0.465, 1.18, 0.07, 0.14, 0.065, "turquesa");  // pie
    pieza(ctx, pa, u + 0.38, 1.14, 0.24, 0.05, 0.065, "turquesa");
    pieza(ctx, pa, u + 0.52, 1.52, 0.08, 0.08, 0.07, "verde");       // oliva
  });

  def({
    id: "mesa_copas", nombre: "Mesa de cócteles", categoria: "baile",
    precio: 140, tam: [1, 1], altura: 1.2,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.26, 0.06, "gris_oscuro");
      p.cilindro(0.5, 0.5, 0.06, 0.05, 0.95, "gris");
      p.cilindro(0.5, 0.5, 1.01, 0.34, 0.08, "negro");     // tablero
      p.cilindro(0.36, 0.42, 1.09, 0.06, 0.14, "rosa");    // copas
      p.cilindro(0.62, 0.55, 1.09, 0.06, 0.14, "turquesa");
      p.cilindro(0.5, 0.68, 1.09, 0.045, 0.1, "blanco");
    },
  });

  def({
    id: "torre_luces", nombre: "Torre de luces", categoria: "baile",
    precio: 300, tam: [1, 1], rotaciones: 4, altura: 2.0,
    luz: { x: 0.5, y: 0.5, z: 1.6, radio: 52, color: [143, 111, 180] },
    dibujar: function (p) {
      p.cubo(0.25, 0.25, 0, 0.5, 0.5, 0.12, "gris_oscuro");
      p.cubo(0.42, 0.42, 0.12, 0.16, 0.16, 1.3, "gris");   // torre
      p.cubo(0.2, 0.3, 1.42, 0.6, 0.4, 0.3, "gris_oscuro"); // cabezal
      p.cubo(0.8, 0.34, 1.48, 0.05, 0.14, 0.18, "rojo");   // lentes
      p.cubo(0.8, 0.54, 1.48, 0.05, 0.14, 0.18, "verde");
      p.cubo(0.32, 0.7, 1.48, 0.16, 0.05, 0.18, "azul");
      p.cubo(0.56, 0.7, 1.48, 0.16, 0.05, 0.18, "morado");
    },
  });

  // --- otros ---

  def({
    id: "mesa_billar", nombre: "Mesa de billar", categoria: "otros",
    precio: 600, tam: [2, 1], rotaciones: 2, altura: 0.95,
    dibujar: function (p) {
      patas4(p, 0.12, 0.08, 1.88, 0.92, 0.16, 0.55, "madera_oscura");
      p.cubo(0.02, 0.02, 0.55, 1.96, 0.96, 0.25, "madera_oscura");
      p.cubo(0.1, 0.1, 0.8, 1.8, 0.8, 0.06, "verde");      // tapete
      p.cilindro(0.12, 0.12, 0.8, 0.07, 0.07, "negro");    // troneras
      p.cilindro(1.88, 0.12, 0.8, 0.07, 0.07, "negro");
      p.cilindro(0.12, 0.88, 0.8, 0.07, 0.07, "negro");
      p.cilindro(1.88, 0.88, 0.8, 0.07, 0.07, "negro");
      p.cilindro(0.7, 0.45, 0.86, 0.05, 0.05, "blanco");   // bolas
      p.cilindro(1.2, 0.4, 0.86, 0.05, 0.05, "rojo");
      p.cilindro(1.32, 0.55, 0.86, 0.05, 0.05, "amarillo");
      p.cilindro(1.25, 0.62, 0.86, 0.05, 0.05, "azul");
    },
  });

  def({
    id: "globo_terraqueo", nombre: "Globo terráqueo", categoria: "otros",
    precio: 115, tam: [1, 1], altura: 1.15,
    dibujar: function (p) {
      p.cilindro(0.5, 0.5, 0, 0.24, 0.08, "madera_oscura");
      p.cilindro(0.5, 0.5, 0.08, 0.045, 0.3, "madera");
      p.cilindro(0.5, 0.5, 0.38, 0.28, 0.5, "azul");       // globo
      p.cubo(0.32, 0.4, 0.55, 0.2, 0.22, 0.14, "verde");   // continentes
      p.cubo(0.58, 0.34, 0.68, 0.18, 0.18, 0.12, "verde");
      p.cilindro(0.5, 0.5, 0.88, 0.05, 0.1, "amarillo");   // eje
    },
  });

  def({
    id: "telescopio", nombre: "Telescopio", categoria: "otros",
    precio: 270, tam: [1, 1], rotaciones: 4, altura: 1.5,
    dibujar: function (p) {
      p.cubo(0.44, 0.2, 0, 0.1, 0.1, 0.85, "gris_oscuro"); // trípode
      p.cubo(0.24, 0.66, 0, 0.1, 0.1, 0.85, "gris_oscuro");
      p.cubo(0.64, 0.66, 0, 0.1, 0.1, 0.85, "gris_oscuro");
      p.cubo(0.3, 0.42, 0.85, 0.3, 0.16, 0.16, "blanco");  // tubo
      p.cubo(0.6, 0.44, 0.98, 0.3, 0.12, 0.12, "blanco");
      p.cilindro(0.88, 0.5, 1.02, 0.07, 0.06, "azul");     // lente
      p.cubo(0.24, 0.45, 0.82, 0.08, 0.1, 0.1, "negro");   // ocular
    },
  });

  def({
    id: "bateria", nombre: "Batería", categoria: "otros",
    precio: 480, tam: [2, 2], rotaciones: 4, altura: 1.2,
    dibujar: function (p) {
      p.cilindro(1.3, 1.0, 0, 0.4, 0.5, "rojo");           // bombo
      p.cilindro(1.3, 1.0, 0.5, 0.4, 0.04, "blanco");
      p.cilindro(0.55, 0.5, 0.45, 0.24, 0.25, "rojo");     // toms
      p.cilindro(0.55, 0.5, 0.7, 0.24, 0.03, "blanco");
      p.cilindro(0.55, 1.45, 0.45, 0.24, 0.25, "rojo");
      p.cilindro(0.55, 1.45, 0.7, 0.24, 0.03, "blanco");
      p.cilindro(1.65, 0.3, 0, 0.03, 1.0, "gris");         // pie platillo
      p.cilindro(1.65, 0.3, 1.0, 0.24, 0.04, "amarillo");  // platillo
      p.cilindro(0.3, 1.0, 0, 0.03, 0.85, "gris");
      p.cilindro(0.3, 1.0, 0.85, 0.2, 0.04, "amarillo");
    },
  });

  def({
    id: "caballete", nombre: "Caballete de pintor", categoria: "otros",
    precio: 135, tam: [1, 1], rotaciones: 4, altura: 1.7,
    dibujar: function (p) {
      p.cubo(0.3, 0.2, 0, 0.09, 0.09, 1.55, "madera");     // patas delanteras
      p.cubo(0.3, 0.72, 0, 0.09, 0.09, 1.55, "madera");
      p.cubo(0.62, 0.46, 0, 0.09, 0.09, 1.3, "madera");    // pata trasera
      p.cubo(0.28, 0.14, 0.55, 0.12, 0.72, 0.08, "madera_oscura"); // bandeja
      p.cubo(0.36, 0.18, 0.63, 0.06, 0.64, 0.85, "blanco"); // lienzo
      p.cubo(0.42, 0.3, 0.95, 0.015, 0.3, 0.25, "azul");   // pintura
      p.cubo(0.42, 0.45, 0.75, 0.015, 0.22, 0.18, "rojo");
      p.cubo(0.42, 0.26, 0.72, 0.015, 0.14, 0.35, "amarillo");
    },
  });

  // ----------------------------------------------------------
  // API
  // ----------------------------------------------------------

  function get(id) {
    var f = defs[id];
    if (!f) console.error('Furnis: id desconocido → "' + id + '"');
    return f;
  }

  function lista() {
    return orden.map(function (id) {
      return defs[id];
    });
  }

  function categorias() {
    return CATEGORIAS;
  }

  function pie(id, rot) {
    var f = get(id);
    return rot % 2 ? [f.tam[1], f.tam[0]] : [f.tam[0], f.tam[1]];
  }

  // Transforma un punto local del furni según su rotación
  // (p. ej. la posición de su fuente de luz def.luz)
  function puntoRotado(id, rot, lx, ly) {
    var f = get(id), an = f.tam[0], fo = f.tam[1];
    switch (rot || 0) {
      case 1: return { x: fo - ly, y: lx };
      case 2: return { x: an - lx, y: fo - ly };
      case 3: return { x: ly, y: an - lx };
      default: return { x: lx, y: ly };
    }
  }

  function dibujar(ctx, id, x, y, rot) {
    var f = get(id);
    if (!f) return;
    var p = new Pincel(f.tam[0], f.tam[1], rot || 0);
    f.dibujar(p);
    var partes = Iso.ordenarCajas(p.partes);
    for (var i = 0; i < partes.length; i++) {
      var q = partes[i];
      if (q.tipo === "cubo") {
        Iso.cubo(
          ctx,
          x + q.x0,
          y + q.y0,
          q.z0,
          q.x1 - q.x0,
          q.y1 - q.y0,
          q.z1 - q.z0,
          q.color,
        );
      } else if (q.tipo === "plano") {
        Iso.plano(
          ctx,
          x + q.x0,
          y + q.y0,
          q.z0,
          q.x1 - q.x0,
          q.y1 - q.y0,
          q.color,
        );
      } else {
        Iso.cilindro(ctx, x + q.cx, y + q.cy, q.z0, q.radio, q.alto, q.color);
      }
    }
  }

  // Miniatura centrada y escalada en un canvas (catálogo/inventario)
  function miniatura(canvas, id) {
    var f = get(id);
    if (!f) return;
    // las miniaturas siempre con luz de día, sea la hora que sea
    var ambientePrevio = Paleta.ambiente();
    Paleta.ponAmbiente("manana");
    try {
      miniaturaInterna(canvas, f, id);
    } finally {
      Paleta.ponAmbiente(ambientePrevio);
    }
  }

  function miniaturaInterna(canvas, f, id) {
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    if (f.capa === "pared") {
      var z0 = f.zPared,
        hP = f.altoPared;
      var escP = Math.min(
        canvas.width / (Iso.MX + 26),
        canvas.height / (hP * Iso.MZ + 40),
        2.0,
      );
      var sxc = 0.5 * Iso.MX;
      var syc = 0.5 * Iso.MY - (z0 + hP / 2) * Iso.MZ;
      ctx.translate(
        canvas.width / 2 - escP * sxc,
        canvas.height / 2 - escP * syc,
      );
      ctx.scale(escP, escP);
      // trocito de pared como fondo
      Iso.cubo(
        ctx,
        -0.15,
        -0.16,
        z0 - 0.32,
        1.3,
        0.16,
        hP + 0.64,
        "azul_claro",
      );
      f.dibujarPared(ctx, "x", 0);
      ctx.restore();
      return;
    }

    var an = f.tam[0],
      fo = f.tam[1],
      alt = f.altura || 1;
    var margen = 16;
    var pxAncho = (an + fo) * Iso.MX + margen;
    var pxAlto = (an + fo) * Iso.MY + alt * Iso.MZ + margen;
    var esc = Math.min(canvas.width / pxAncho, canvas.height / pxAlto, 1.5);
    ctx.translate(
      canvas.width / 2,
      canvas.height / 2 + (esc * alt * Iso.MZ) / 2,
    );
    ctx.scale(esc, esc);
    Iso.plano(ctx, -an / 2, -fo / 2, 0, an, fo, "beige");
    Iso.sombra(ctx, -an / 2, -fo / 2, an, fo);
    dibujar(ctx, id, -an / 2, -fo / 2, 0);
    ctx.restore();
  }

  return {
    get: get,
    lista: lista,
    categorias: categorias,
    pie: pie,
    puntoRotado: puntoRotado,
    dibujar: dibujar,
    miniatura: miniatura,
  };
})();
