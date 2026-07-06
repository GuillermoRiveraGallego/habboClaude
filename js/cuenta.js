"use strict";

// ============================================================
// CUENTA — UI de autenticación (Supabase Auth) vía el módulo Nube.
//
// Modal con dos estados: sin sesión (pestañas Entrar / Registrarse
// + "Seguir en local") y con sesión (email + Cerrar sesión).
//
// AUTÓNOMO (T4.2): no está cableado al HUD ni al arranque; se abre
// a mano con `Cuenta.abrir()`. `iniciar()` es perezoso (se llama
// solo la primera vez que hace falta), así que desde la consola
// basta `Cuenta.abrir()`.
//
// NO toca el guardado ni el estado del juego: iniciar o cerrar
// sesión aquí solo gestiona la sesión de Supabase. Cargar/guardar
// partidas en la nube y la migración llegan en T5/T6.
// ============================================================
var Cuenta = (function () {

  var elFondo = null;
  var elContenido = null;
  var montado = false;
  var pestana = "entrar";   // "entrar" | "registrar"

  // ---------------- montaje / apertura ----------------

  function iniciar() {
    if (montado) return;
    elFondo = document.createElement("div");
    elFondo.id = "modal-fondo-cuenta";
    elFondo.className = "oculto";
    elFondo.innerHTML =
      '<div id="modal-cuenta">' +
        '<div class="mc-barra"><span>👤 Cuenta</span>' +
        '<button id="mc-cerrar" title="Cerrar">✕</button></div>' +
        '<div id="mc-contenido"></div>' +
      '</div>';
    var zona = document.getElementById("zona-canvas") || document.body;
    zona.appendChild(elFondo);
    elContenido = elFondo.querySelector("#mc-contenido");
    elFondo.querySelector("#mc-cerrar").addEventListener("click", cerrar);
    elFondo.addEventListener("click", function (e) {
      if (e.target === elFondo) cerrar();
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && elFondo && !elFondo.classList.contains("oculto")) cerrar();
    });
    montado = true;
  }

  function abrir() {
    iniciar();
    elFondo.classList.remove("oculto");
    render();
  }

  function cerrar() {
    if (elFondo) elFondo.classList.add("oculto");
  }

  // ---------------- render según sesión ----------------

  function render() {
    iniciar();
    if (!window.Nube || !Nube.disponible()) {
      pintarSinNube();
      return;
    }
    Nube.usuario().then(function (u) {
      if (u) pintarLogueado(u);
      else pintarFormulario();
    }).catch(function () {
      pintarFormulario();
    });
  }

  function pintarSinNube() {
    elContenido.innerHTML =
      '<p class="mc-info">Supabase no está configurado.</p>' +
      '<p class="mc-nota">Estás jugando en local. Para usar cuentas, añade tus claves en <b>config.js</b>.</p>' +
      '<button class="mc-boton mc-secundario" id="mc-local">Seguir en local</button>';
    elContenido.querySelector("#mc-local").addEventListener("click", cerrar);
  }

  function pintarLogueado(u) {
    elContenido.innerHTML =
      '<p class="mc-info">Sesión iniciada como<br><b></b></p>' +
      '<button class="mc-boton mc-secundario" id="mc-salir">Cerrar sesión</button>' +
      '<p class="mc-nota">El progreso se sigue guardando en este navegador (local). ' +
      'La sincronización con la nube llegará más adelante.</p>';
    // textContent evita inyección con el email del usuario
    elContenido.querySelector(".mc-info b").textContent = u.email || "(usuario)";
    elContenido.querySelector("#mc-salir").addEventListener("click", function () {
      Nube.salir().then(render);
    });
  }

  function pintarFormulario() {
    elContenido.innerHTML =
      '<div class="mc-tabs">' +
        '<button class="mc-tab" data-p="entrar">Entrar</button>' +
        '<button class="mc-tab" data-p="registrar">Registrarse</button>' +
      '</div>' +
      '<form id="mc-form">' +
        '<input class="mc-campo" type="email" id="mc-email" placeholder="tu@email.com" autocomplete="username">' +
        '<input class="mc-campo" type="password" id="mc-pass" placeholder="contraseña (mín. 6)" autocomplete="current-password">' +
        '<button class="mc-boton" type="submit" id="mc-enviar"></button>' +
      '</form>' +
      '<button class="mc-boton mc-secundario" id="mc-local">Seguir en local</button>' +
      '<p class="mc-mensaje" id="mc-mensaje"></p>';

    var tabs = elContenido.querySelectorAll(".mc-tab");
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        if (t.getAttribute("data-p") === pestana) t.classList.add("activa");
        t.addEventListener("click", function () {
          pestana = t.getAttribute("data-p");
          pintarFormulario();
        });
      })(tabs[i]);
    }
    elContenido.querySelector("#mc-enviar").textContent =
      (pestana === "registrar") ? "Crear cuenta" : "Entrar";
    elContenido.querySelector("#mc-local").addEventListener("click", cerrar);
    elContenido.querySelector("#mc-form").addEventListener("submit", enviar);
  }

  // ---------------- acciones ----------------

  function enviar(e) {
    e.preventDefault();
    var email = elContenido.querySelector("#mc-email").value.trim();
    var pass = elContenido.querySelector("#mc-pass").value;
    var btn = elContenido.querySelector("#mc-enviar");
    if (!email || !pass) {
      mensaje("Escribe email y contraseña.", "error");
      return;
    }
    btn.disabled = true;
    mensaje("Conectando…", "");
    var accion = (pestana === "registrar")
      ? Nube.registrar(email, pass)
      : Nube.entrar(email, pass);
    accion.then(function (res) {
      if (res && res.error) {
        btn.disabled = false;
        mensaje(res.error.message || "No se pudo completar.", "error");
      } else {
        // sesión iniciada → repintar al estado logueado
        render();
      }
    }).catch(function (err) {
      btn.disabled = false;
      mensaje((err && err.message) || "Error de conexión.", "error");
    });
  }

  function mensaje(txt, tipo) {
    var el = elContenido.querySelector("#mc-mensaje");
    if (!el) return;
    el.textContent = txt || "";
    el.className = "mc-mensaje" + (tipo ? " " + tipo : "");
  }

  return {
    iniciar: iniciar,
    abrir: abrir,
    cerrar: cerrar,
    render: render
  };
})();
