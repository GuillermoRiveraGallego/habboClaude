"use strict";

// ============================================================
// GUARDADO — persistencia automática del juego.
//
// Estructura (T3): una COSTURA de backends intercambiables.
//   - `Guardado` es el ORQUESTADOR: la única frontera de
//     persistencia del juego (cargar/guardar/iniciar/reiniciar).
//     Gestiona el autoguardado (debounce tras cada cambio, red de
//     seguridad cada 10 s, y al cerrar/ocultar la pestaña) y el
//     aviso de error; delega el leer/escribir en el backend activo.
//   - `AlmacenLocal` es el backend de localStorage (clave única
//     "habbo_solo_v1" con todo Juego.estado()). Es SÍNCRONO.
//
// Backend activo por defecto: local. El hook `usarBackend()` queda
// preparado para que T4/T5 enchufen el backend de nube (asíncrono,
// aún inexistente) cuando haya sesión de Auth y Nube.disponible().
//
// Contrato de un backend:
//   { nombre, cargar()->estado|null, guardar(estado)->bool,
//     reiniciar()->void }   (cargar/guardar pueden ser Promesa;
//   el backend local no lo es, así que los tests y el arranque
//   síncronos siguen funcionando igual.)
//
// Lo efímero (posiciones de mascotas, animaciones, caminos) nunca
// se guarda: vive en los módulos y se regenera.
// ============================================================

// ---- Backend: localStorage (síncrono) ----------------------
var AlmacenLocal = (function () {

  var CLAVE = "habbo_solo_v1";
  var VERSION = 1;

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

  // Escribe el estado completo. Lanza si falla; el orquestador
  // es quien avisa del error.
  function guardar(estado) {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
    return true;
  }

  function reiniciar() {
    try { localStorage.removeItem(CLAVE); } catch (e) {}
  }

  return {
    nombre: "local",
    CLAVE: CLAVE,
    VERSION: VERSION,
    cargar: cargar,
    guardar: guardar,
    reiniciar: reiniciar
  };
})();

// ---- Orquestador -------------------------------------------
var Guardado = (function () {

  var backend = AlmacenLocal;   // backend activo (T3: siempre local)

  var tempo = null;
  var desactivado = false;  // tras reiniciar: no volver a guardar
  var avisadoError = false;
  var alError = null;

  // Preparado para T4/T5: enchufar el backend de nube cuando exista
  // sesión de Auth y Nube.disponible(). Sin uso todavía.
  function usarBackend(b) {
    if (b) backend = b;
  }

  function guardar() {
    if (desactivado) return false;
    var estado = Juego.estado();
    if (!estado) return false;
    try {
      backend.guardar(estado);
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
    return backend.cargar();
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
    backend.reiniciar();
  }

  return {
    CLAVE: AlmacenLocal.CLAVE,   // lo usan los modos de prueba
    usarBackend: usarBackend,
    iniciar: iniciar,
    guardar: guardar,
    cargar: cargar,
    reiniciar: reiniciar
  };
})();
