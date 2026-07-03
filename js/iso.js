"use strict";

// ============================================================
// ISO — proyección isométrica y primitivas de dibujo.
// Toda la luz del juego vive aquí: cada primitiva asigna las
// variantes de la paleta a sus caras (superior clara, izquierda
// media, derecha oscura), de modo que es imposible dibujar con
// otra dirección de luz.
//
// Unidades de mundo: 1.0 = una casilla en x/y; 1.0 de z = una
// casilla de alto (32 px). Los furnis se construyen en
// múltiplos de media casilla.
// ============================================================
var Iso = (function () {

  var MX = 32;  // medio ancho de casilla en px
  var MY = 16;  // medio alto de casilla en px
  var MZ = 32;  // px por unidad de altura

  var CONTORNO = "rgba(42, 36, 30, 0.25)";

  function proyectar(x, y, z) {
    return { x: (x - y) * MX, y: (x + y) * MY - (z || 0) * MZ };
  }

  function cara(ctx, puntos, color, sinContorno) {
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    for (var i = 1; i < puntos.length; i++) ctx.lineTo(puntos[i].x, puntos[i].y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (!sinContorno) {
      ctx.strokeStyle = CONTORNO;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Cubo con las tres caras visibles sombreadas.
  function cubo(ctx, x, y, z, ancho, fondo, alto, color) {
    var c = Paleta.get(color);
    var A  = proyectar(x, y, z + alto),
        B  = proyectar(x + ancho, y, z + alto),
        C  = proyectar(x + ancho, y + fondo, z + alto),
        D  = proyectar(x, y + fondo, z + alto),
        B2 = proyectar(x + ancho, y, z),
        C2 = proyectar(x + ancho, y + fondo, z),
        D2 = proyectar(x, y + fondo, z);
    cara(ctx, [D, C, C2, D2], c.izq);  // cara frontal izquierda
    cara(ctx, [B, C, C2, B2], c.der);  // cara frontal derecha
    cara(ctx, [A, B, C, D], c.sup);    // cara superior
  }

  // Plano horizontal (suelo, alfombras, tapas sin grosor).
  function plano(ctx, x, y, z, ancho, fondo, color) {
    var c = Paleta.get(color);
    cara(ctx, [
      proyectar(x, y, z),
      proyectar(x + ancho, y, z),
      proyectar(x + ancho, y + fondo, z),
      proyectar(x, y + fondo, z)
    ], c.sup);
  }

  // Cilindro vertical centrado en (cx, cy). Sombreado facetado:
  // mitad izquierda en tono medio, derecha en oscuro, tapa clara.
  function cilindro(ctx, cx, cy, z, radio, alto, color) {
    var c = Paleta.get(color);
    var rx = radio * MX * Math.SQRT2,
        ry = radio * MY * Math.SQRT2;
    var t = proyectar(cx, cy, z + alto),
        b = proyectar(cx, cy, z);
    // cuerpo
    ctx.beginPath();
    ctx.moveTo(t.x - rx, t.y);
    ctx.lineTo(b.x - rx, b.y);
    ctx.ellipse(b.x, b.y, rx, ry, 0, Math.PI, 0, true); // borde inferior
    ctx.lineTo(t.x + rx, t.y);
    ctx.closePath();
    ctx.fillStyle = c.izq;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = c.der;
    ctx.fillRect(b.x + rx * 0.12, t.y - ry - 1, rx, (b.y - t.y) + ry * 2 + 2);
    ctx.restore();
    ctx.strokeStyle = CONTORNO;
    ctx.lineWidth = 1;
    ctx.stroke();
    // tapa
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.sup;
    ctx.fill();
    ctx.stroke();
  }

  // Sombra suave bajo un furni (no es un color de paleta:
  // es negro con transparencia, reservado a este uso).
  function sombra(ctx, x, y, ancho, fondo) {
    var m = 0.07;
    cara(ctx, [
      proyectar(x - m, y - m, 0),
      proyectar(x + ancho + m, y - m, 0),
      proyectar(x + ancho + m, y + fondo + m, 0),
      proyectar(x - m, y + fondo + m, 0)
    ], "rgba(40, 36, 32, 0.16)", true);
  }

  // ------------------------------------------------------------
  // Orden de pintado (pintor). Recibe cajas {x0,y0,z0,x1,y1,z1}
  // y devuelve el orden correcto de atrás hacia delante usando
  // separación por ejes + orden topológico. Sirve tanto para las
  // piezas de un furni como para los furnis y el avatar de una
  // sala completa.
  // ------------------------------------------------------------
  function ordenarCajas(cajas) {
    var n = cajas.length;
    if (n < 2) return cajas.slice();
    var E = 0.001;

    // a está detrás de b si queda separado hacia atrás en algún eje
    function detras(a, b) {
      return a.x1 <= b.x0 + E || a.y1 <= b.y0 + E || a.z1 <= b.z0 + E;
    }

    // ¿se solapan sus proyecciones en pantalla? (si no, el orden da igual)
    function solapan(a, b) {
      if ((a.x1 - a.y0) <= (b.x0 - b.y1) || (b.x1 - b.y0) <= (a.x0 - a.y1)) return false;
      var aTop = (a.x0 + a.y0) * MY - a.z1 * MZ, aBot = (a.x1 + a.y1) * MY - a.z0 * MZ;
      var bTop = (b.x0 + b.y0) * MY - b.z1 * MZ, bBot = (b.x1 + b.y1) * MY - b.z0 * MZ;
      return aBot > bTop && bBot > aTop;
    }

    var sig = [], grado = [], i, j;
    for (i = 0; i < n; i++) { sig.push([]); grado.push(0); }
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var a = cajas[i], b = cajas[j];
        if (!solapan(a, b)) continue;
        var ab = detras(a, b), ba = detras(b, a);
        if (ab && !ba) { sig[i].push(j); grado[j]++; }
        else if (ba && !ab) { sig[j].push(i); grado[i]++; }
        // piezas interpenetradas o ambiguas: sin restricción
      }
    }

    var usado = [], orden = [];
    for (i = 0; i < n; i++) usado.push(false);
    for (var k = 0; k < n; k++) {
      var elegido = -1, mejorClave = Infinity, hayCero = false;
      for (i = 0; i < n; i++) {
        if (usado[i]) continue;
        var clave = cajas[i].x1 + cajas[i].y1;
        if (grado[i] === 0) {
          if (!hayCero || clave < mejorClave) { hayCero = true; elegido = i; mejorClave = clave; }
        } else if (!hayCero && (elegido < 0 || clave < mejorClave)) {
          elegido = i; mejorClave = clave;
        }
      }
      usado[elegido] = true;
      orden.push(cajas[elegido]);
      for (i = 0; i < sig[elegido].length; i++) grado[sig[elegido][i]]--;
    }
    return orden;
  }

  return {
    MX: MX, MY: MY, MZ: MZ,
    proyectar: proyectar,
    cubo: cubo,
    plano: plano,
    cilindro: cilindro,
    sombra: sombra,
    ordenarCajas: ordenarCajas
  };
})();
