"use strict";

// ============================================================
// MOVIL — chrome táctil para móviles. NO añade funcionalidad:
// reorganiza el HUD existente en tres piezas pensadas para el
// pulgar:
//   · tira de estado ARRIBA (créditos, sala, ciclo día/noche),
//   · barra de pestañas ABAJO con las acciones principales y
//     etiquetas visibles (Decorar/Pasear, Catálogo, Inventario,
//     Salas) más un botón ☰ "Más",
//   · cajón "Más" que agrupa el resto (Tareas, Mascotas, Avatar,
//     Cuenta) en filas grandes y etiquetadas.
//
// Todos sus botones son PROXIES: reutilizan los handlers del HUD
// real (ya cableados por UI) despachando .click() sobre los
// botones originales. No toca la lógica del juego ni el estado.
//
// El modo móvil se activa con la clase body.movil, que pone/quita
// Movil según el breakpoint (o forzado en pruebas). En escritorio
// todo el chrome queda oculto y el HUD se muestra tal cual.
// ============================================================
var Movil = (function () {

  var MQ = "(max-width: 640px)";
  var construido = false;
  var forzado = false;                 // hook de prueba: fuerza el modo móvil
  var hud, hudBotones, elTop, elDrawer, elFondo, btnMas;
  var cartera, salaCaja, ambiente;     // chips que viajan a la tira superior

  function esMovil() {
    return forzado || window.matchMedia(MQ).matches;
  }

  // ---- cajón "Más" ----

  function abrirDrawer() {
    elDrawer.classList.remove("oculto");
    elFondo.classList.remove("oculto");
    btnMas.classList.add("activo");
  }

  function cerrarDrawer() {
    elDrawer.classList.add("oculto");
    elFondo.classList.add("oculto");
    btnMas.classList.remove("activo");
  }

  // Proxy: cierra el cajón y reenvía la acción al botón real del HUD,
  // de modo que se reutiliza su handler (UI.abrirPanel, Cuenta.abrir…).
  function proxy(selector) {
    return function () {
      cerrarDrawer();
      var real = document.querySelector(selector);
      if (real) real.click();
    };
  }

  function item(html, alPulsar) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "md-item";
    b.innerHTML = html;
    b.addEventListener("click", alPulsar);
    return b;
  }

  function grupo(titulo, items) {
    var h = document.createElement("h4");
    h.textContent = titulo;
    elDrawer.appendChild(h);
    var rej = document.createElement("div");
    rej.className = "md-rejilla";
    items.forEach(function (it) { rej.appendChild(it); });
    elDrawer.appendChild(rej);
  }

  // ---- construcción (una vez) ----

  function construir() {
    if (construido) return;
    hud = document.getElementById("hud");
    hudBotones = document.getElementById("hud-botones");
    cartera = document.getElementById("hud-cartera");
    salaCaja = document.getElementById("hud-sala-caja");
    ambiente = document.getElementById("btn-ambiente");
    var app = document.getElementById("app");

    // tira de estado superior (recibe los chips existentes)
    elTop = document.createElement("div");
    elTop.id = "movil-top";

    // fondo oscuro y cajón "Más"
    elFondo = document.createElement("div");
    elFondo.id = "movil-drawer-fondo";
    elFondo.className = "oculto";
    elFondo.addEventListener("click", cerrarDrawer);

    elDrawer = document.createElement("div");
    elDrawer.id = "movil-drawer";
    elDrawer.className = "oculto";
    var tirador = document.createElement("div");
    tirador.className = "md-tirador";
    elDrawer.appendChild(tirador);

    grupo("Actividades", [
      item('<span class="md-icono">📋</span> Tareas',   proxy('#hud [data-panel="tareas"]')),
      item('<span class="md-icono">🐾</span> Mascotas', proxy('#hud [data-panel="mascotas"]'))
    ]);

    var personales = [
      item('<span class="md-icono">👤</span> Avatar', proxy('#hud [data-panel="avatar"]'))
    ];
    // La cuenta se oculta en los modos de prueba (igual que el botón
    // ☁️ del HUD); solo la ofrecemos si ese botón está disponible.
    var btnCuenta = document.getElementById("btn-cuenta");
    if (btnCuenta && btnCuenta.style.display !== "none") {
      personales.push(item('<span class="md-icono">☁️</span> Cuenta', proxy('#btn-cuenta')));
    }
    grupo("Tú", personales);

    // botón "Más" dentro de la barra inferior (oculto en escritorio)
    btnMas = document.createElement("button");
    btnMas.id = "btn-mas";
    btnMas.type = "button";
    btnMas.innerHTML = '☰ <span class="etiqueta">Más</span>';
    btnMas.addEventListener("click", function () {
      if (elDrawer.classList.contains("oculto")) abrirDrawer();
      else cerrarDrawer();
    });
    hudBotones.appendChild(btnMas);

    app.appendChild(elTop);
    app.appendChild(elFondo);
    app.appendChild(elDrawer);
    construido = true;
  }

  // ---- sincronización con el breakpoint (idempotente) ----

  function sincronizar() {
    if (!construido) return;
    var movil = esMovil();
    document.body.classList.toggle("movil", movil);
    if (movil) {
      // los chips de estado suben a la tira superior
      if (cartera.parentNode !== elTop) elTop.appendChild(cartera);
      if (salaCaja.parentNode !== elTop) elTop.appendChild(salaCaja);
      if (ambiente && ambiente.parentNode !== elTop) elTop.appendChild(ambiente);
    } else {
      // vuelven a su sitio del HUD (antes del bloque de botones)
      cerrarDrawer();
      if (cartera.parentNode !== hud) hud.insertBefore(cartera, hudBotones);
      if (salaCaja.parentNode !== hud) hud.insertBefore(salaCaja, hudBotones);
      if (ambiente && ambiente.parentNode !== hud) hud.insertBefore(ambiente, hudBotones);
    }
    // el panel lateral se ancla sobre el HUD real: re-medir su alto
    document.documentElement.style.setProperty("--alto-hud", hud.offsetHeight + "px");
  }

  // ---- arranque ----

  var temp = null;
  function iniciar() {
    construir();
    sincronizar();
    window.addEventListener("resize", function () {
      clearTimeout(temp);
      temp = setTimeout(sincronizar, 120);
    });
  }

  return {
    iniciar: iniciar,
    // hooks para las pruebas y capturas
    depurar: {
      forzarMovil: function (on) { forzado = !!on; sincronizar(); },
      abrirDrawer: abrirDrawer,
      cerrarDrawer: cerrarDrawer,
      esMovil: esMovil
    }
  };
})();
