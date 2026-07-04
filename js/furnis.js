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
