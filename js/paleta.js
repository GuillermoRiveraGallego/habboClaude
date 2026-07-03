"use strict";

// ============================================================
// PALETA — paleta global cerrada del juego (20 colores).
// Cada color tiene tres variantes precalculadas para la luz
// isométrica única del juego:
//   sup — cara superior (clara)
//   izq — cara lateral izquierda (tono medio, el base)
//   der — cara frontal derecha (oscura)
// Los furnis SOLO referencian colores por nombre. Usar un
// nombre fuera de paleta pinta magenta y avisa por consola.
// ============================================================
var Paleta = (function () {

  var BASES = {
    // Neutros
    blanco:        "#f2efe6",
    crema:         "#e8dcbe",
    beige:         "#cfba94",
    gris:          "#a3a8af",
    gris_oscuro:   "#5c616b",
    negro:         "#343740",
    // Maderas y tierras
    madera:        "#bb8a54",
    madera_oscura: "#84583a",
    marron:        "#8d6248",
    // Vivos
    rojo:          "#c95349",
    naranja:       "#e08f45",
    amarillo:      "#e4c25a",
    verde:         "#7fae5c",
    verde_oscuro:  "#4f7c48",
    turquesa:      "#58b2a4",
    azul:          "#5382b8",
    azul_claro:    "#93badb",
    morado:        "#8f6fb4",
    rosa:          "#d892ab",
    piel:          "#e3b995"
  };

  // --- Conversión de color para precalcular variantes ---

  function hexARgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbAHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }

  function hslAHex(h, s, l) {
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }
    function cb(v) {
      var s2 = Math.round((v + m) * 255).toString(16);
      return s2.length === 1 ? "0" + s2 : s2;
    }
    return "#" + cb(r) + cb(g) + cb(b);
  }

  function variante(hex, deltaL) {
    var rgb = hexARgb(hex);
    var hsl = rgbAHsl(rgb[0], rgb[1], rgb[2]);
    var l = Math.max(4, Math.min(96, hsl[2] + deltaL));
    return hslAHex(hsl[0], hsl[1], l);
  }

  var colores = {};
  Object.keys(BASES).forEach(function (nombre) {
    var b = BASES[nombre];
    colores[nombre] = {
      base: b,
      sup: variante(b, 12),
      izq: b,
      der: variante(b, -15)
    };
  });

  var ERROR = { base: "#ff00ff", sup: "#ff66ff", izq: "#ff00ff", der: "#aa00aa" };

  function get(nombre) {
    var c = colores[nombre];
    if (!c) {
      console.error("Paleta: color fuera de paleta → \"" + nombre + "\"");
      return ERROR;
    }
    return c;
  }

  return {
    get: get,
    nombres: Object.keys(BASES)
  };
})();
