"use strict";

// ============================================================
// GUARDADO — persistencia automática en localStorage.
//
// - Clave única "habbo_solo_v1" con todo Juego.estado()
//   (salas, furnis, créditos, inventario, mascotas, comida,
//   recompensas, minijuegos y aspecto del avatar).
// - Autoguardado: tras cada cambio de estado (con un pequeño
//   debounce), cada 10 segundos como red de seguridad (los
//   furnis colocados y las estadísticas de las mascotas mutan
//   sin pasar por Juego), y al cerrar u ocultar la pestaña.
// - La carga valida la versión y aplica una migración
//   defensiva: rellena campos que falten en partidas antiguas,
//   garantiza el ordenador fijo del salón y el jardín.
// - Lo efímero (posiciones de mascotas, animaciones, caminos)
//   nunca se guarda: vive en los módulos y se regenera.
// ============================================================
var Guardado = (function () {

  var CLAVE = "habbo_solo_v1";
  var VERSION = 1;

  var tempo = null;
  var desactivado = false;  // tras reiniciar: no volver a guardar
  var avisadoError = false;
  var alError = null;

  function guardar() {
    if (desactivado) return false;
    try {
      var estado = Juego.estado();
      if (!estado) return false;
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      console.error("Guardado: no se pudo guardar", e);
      if (!avisadoError && alError) {
        avisadoError = true;
        alError();
      }
      return false;
    }
  }

  function cargar() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      var datos = JSON.parse(crudo);
      if (!datos || datos.version !== VERSION) {
        console.warn("Guardado: versión desconocida, se descarta");
        return null;
      }
      return datos;
    } catch (e) {
      console.error("Guardado: partida corrupta, se descarta", e);
      return null;
    }
  }

  // guardado con debounce (lo dispara cada cambio de Juego)
  function programar() {
    if (tempo) clearTimeout(tempo);
    tempo = setTimeout(guardar, 400);
  }

  function iniciar(opciones) {
    alError = (opciones && opciones.alError) || null;
    Juego.ponAlCambiar(programar);
    setInterval(guardar, 10000);
    window.addEventListener("beforeunload", guardar);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") guardar();
    });
  }

  // borra la partida y evita que se re-guarde antes de recargar
  function reiniciar() {
    desactivado = true;
    try { localStorage.removeItem(CLAVE); } catch (e) {}
  }

  return {
    CLAVE: CLAVE,
    iniciar: iniciar,
    guardar: guardar,
    cargar: cargar,
    reiniciar: reiniciar
  };
})();
