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

  return {
    MX: MX, MY: MY, MZ: MZ,
    proyectar: proyectar,
    cubo: cubo,
    plano: plano,
    cilindro: cilindro,
    sombra: sombra
  };
})();
