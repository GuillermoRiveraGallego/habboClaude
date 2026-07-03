"use strict";

// ============================================================
// FURNIS — catálogo de muebles. Cada furni se construye SOLO
// con las primitivas de Iso (cubo, plano, cilindro) y colores
// de la Paleta. La misma función dibujar() se usa en la sala,
// en el catálogo y en el inventario.
//
// Fase 1: los 5 furnis de muestra para validar el estilo.
// ============================================================
var Furnis = (function () {

  var defs = {};
  var orden = [];

  function def(f) {
    defs[f.id] = f;
    orden.push(f.id);
  }

  // ----------------------------------------------------------
  // MESA DE MADERA (1×1, alto 1.0)
  // ----------------------------------------------------------
  def({
    id: "mesa_madera", nombre: "Mesa de madera", categoria: "mesas",
    precio: 60, tam: [1, 1], altura: 1.0, rotaciones: 1,
    sentable: null, capa: "furni",
    dibujar: function (ctx, x, y, rot) {
      var g = 0.10, p = 0.12; // margen y grosor de pata
      Iso.cubo(ctx, x + g, y + g, 0, p, p, 0.85, "madera_oscura");
      Iso.cubo(ctx, x + 1 - g - p, y + g, 0, p, p, 0.85, "madera_oscura");
      Iso.cubo(ctx, x + g, y + 1 - g - p, 0, p, p, 0.85, "madera_oscura");
      Iso.cubo(ctx, x + 1 - g - p, y + 1 - g - p, 0, p, p, 0.85, "madera_oscura");
      Iso.cubo(ctx, x, y, 0.85, 1, 1, 0.15, "madera"); // tablero
    }
  });

  // ----------------------------------------------------------
  // SILLA ROJA (1×1, asiento a 0.5, respaldo hasta 1.25)
  // Mira hacia +x (respaldo en el lado de x pequeño).
  // ----------------------------------------------------------
  def({
    id: "silla_roja", nombre: "Silla roja", categoria: "sillas",
    precio: 45, tam: [1, 1], altura: 1.25, rotaciones: 4,
    sentable: "sentado", capa: "furni",
    dibujar: function (ctx, x, y, rot) {
      var m = 0.18, p = 0.10;
      // patas
      Iso.cubo(ctx, x + m, y + m, 0, p, p, 0.35, "madera_oscura");
      Iso.cubo(ctx, x + 1 - m - p, y + m, 0, p, p, 0.35, "madera_oscura");
      Iso.cubo(ctx, x + m, y + 1 - m - p, 0, p, p, 0.35, "madera_oscura");
      Iso.cubo(ctx, x + 1 - m - p, y + 1 - m - p, 0, p, p, 0.35, "madera_oscura");
      // respaldo (detrás, x pequeño)
      Iso.cubo(ctx, x + m, y + m, 0.35, 0.12, 0.64, 0.90, "rojo");
      // asiento
      Iso.cubo(ctx, x + m + 0.12, y + m, 0.35, 0.52, 0.64, 0.15, "rojo");
    }
  });

  // ----------------------------------------------------------
  // CAMA AZUL (2×1, colchón a 0.43, cabecero hasta 0.9)
  // Cabecero en el lado de x pequeño.
  // ----------------------------------------------------------
  def({
    id: "cama_azul", nombre: "Cama azul", categoria: "camas",
    precio: 180, tam: [2, 1], altura: 0.9, rotaciones: 2,
    sentable: "tumbado", capa: "furni",
    dibujar: function (ctx, x, y, rot) {
      Iso.cubo(ctx, x, y, 0, 0.12, 1, 0.90, "madera_oscura");        // cabecero
      Iso.cubo(ctx, x + 0.12, y, 0, 1.88, 1, 0.25, "madera");        // estructura
      Iso.cubo(ctx, x + 0.16, y + 0.05, 0.25, 1.80, 0.90, 0.18, "blanco"); // colchón
      Iso.cubo(ctx, x + 0.24, y + 0.18, 0.43, 0.42, 0.64, 0.12, "crema"); // almohada
      Iso.cubo(ctx, x + 0.80, y + 0.02, 0.30, 1.18, 0.96, 0.16, "azul");  // manta
    }
  });

  // ----------------------------------------------------------
  // SOFÁ AZUL (2×1, asiento a 0.5, respaldo hasta 1.0)
  // Mira hacia +y (respaldo en el lado de y pequeño).
  // ----------------------------------------------------------
  def({
    id: "sofa_azul", nombre: "Sofá azul", categoria: "sofas",
    precio: 220, tam: [2, 1], altura: 1.0, rotaciones: 4,
    sentable: "sentado", capa: "furni",
    dibujar: function (ctx, x, y, rot) {
      Iso.cubo(ctx, x, y, 0, 2, 1, 0.30, "azul");                    // base
      Iso.cubo(ctx, x, y, 0.30, 2, 0.26, 0.70, "azul");              // respaldo
      Iso.cubo(ctx, x, y + 0.26, 0.30, 0.16, 0.74, 0.40, "azul");    // brazo izquierdo
      Iso.cubo(ctx, x + 0.18, y + 0.28, 0.30, 0.80, 0.66, 0.20, "azul_claro"); // cojín 1
      Iso.cubo(ctx, x + 1.02, y + 0.28, 0.30, 0.80, 0.66, 0.20, "azul_claro"); // cojín 2
      Iso.cubo(ctx, x + 1.84, y + 0.26, 0.30, 0.16, 0.74, 0.40, "azul");  // brazo derecho
    }
  });

  // ----------------------------------------------------------
  // PLANTA HELECHO (1×1, alto ~1.3)
  // ----------------------------------------------------------
  def({
    id: "planta_helecho", nombre: "Planta helecho", categoria: "plantas",
    precio: 35, tam: [1, 1], altura: 1.3, rotaciones: 1,
    sentable: null, capa: "furni",
    dibujar: function (ctx, x, y, rot) {
      var cx = x + 0.5, cy = y + 0.5;
      Iso.cilindro(ctx, cx, cy, 0, 0.20, 0.30, "marron");            // maceta
      Iso.cilindro(ctx, cx, cy, 0.30, 0.23, 0.08, "marron");         // borde
      Iso.cilindro(ctx, cx, cy, 0.38, 0.05, 0.28, "verde_oscuro");   // tallo
      // mata de hojas: masas anchas y bajas, bien abiertas
      Iso.cilindro(ctx, cx - 0.20, cy - 0.14, 0.52, 0.19, 0.20, "verde_oscuro");
      Iso.cilindro(ctx, cx + 0.20, cy - 0.06, 0.56, 0.20, 0.22, "verde");
      Iso.cilindro(ctx, cx - 0.06, cy + 0.20, 0.50, 0.20, 0.20, "verde");
      Iso.cilindro(ctx, cx + 0.02, cy - 0.02, 0.66, 0.22, 0.24, "verde"); // masa central
      Iso.cilindro(ctx, cx, cy, 0.88, 0.13, 0.22, "verde_oscuro");   // brote superior
    }
  });

  // ----------------------------------------------------------
  // API
  // ----------------------------------------------------------

  function get(id) {
    var f = defs[id];
    if (!f) console.error("Furnis: id desconocido → \"" + id + "\"");
    return f;
  }

  function lista() {
    return orden.map(function (id) { return defs[id]; });
  }

  // Dibuja el furni centrado y escalado dentro de un canvas
  // (miniaturas de catálogo e inventario).
  function miniatura(canvas, id) {
    var f = get(id);
    if (!f) return;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var an = f.tam[0], fo = f.tam[1], alt = f.altura || 1;
    var margen = 16;
    var pxAncho = (an + fo) * Iso.MX + margen;
    var pxAlto = (an + fo) * Iso.MY + alt * Iso.MZ + margen;
    var esc = Math.min(canvas.width / pxAncho, canvas.height / pxAlto, 1.5);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + esc * alt * Iso.MZ / 2);
    ctx.scale(esc, esc);
    Iso.plano(ctx, -an / 2, -fo / 2, 0, an, fo, "beige"); // suelo de referencia
    Iso.sombra(ctx, -an / 2, -fo / 2, an, fo);
    f.dibujar(ctx, -an / 2, -fo / 2, 0);
    ctx.restore();
  }

  return {
    get: get,
    lista: lista,
    miniatura: miniatura
  };
})();
