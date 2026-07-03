"use strict";

// ============================================================
// UI — interfaz del juego: HUD (créditos, botones), panel
// lateral (catálogo / inventario / salas), menú del furni
// seleccionado y avisos. Orquesta Juego (estado) y Sala (motor).
// ============================================================
var UI = (function () {

  var elCreditos, elNombreSala, elPanel, elPanelTitulo, elPanelPestanas,
      elPanelContenido, elMenuFurni, elAvisos, elPistaFantasma, btnModo;

  var panelAbierto = null;      // "catalogo" | "inventario" | "salas" | null
  var categoriaActiva = "mesas";
  var movimiento = null;        // furni retirado de la sala mientras se mueve

  var COLORES_SUELO = ["beige", "crema", "blanco", "gris", "madera", "verde", "azul_claro", "rosa"];
  var COLORES_PARED = ["azul_claro", "crema", "amarillo", "verde", "turquesa", "rosa", "morado", "gris"];

  // ---------------- avisos ----------------

  function avisar(texto, tipo) {
    var div = document.createElement("div");
    div.className = "aviso" + (tipo ? " aviso-" + tipo : "");
    div.textContent = texto;
    elAvisos.appendChild(div);
    setTimeout(function () { div.classList.add("visible"); }, 10);
    setTimeout(function () {
      div.classList.remove("visible");
      setTimeout(function () { div.remove(); }, 400);
    }, 2200);
  }

  // ---------------- HUD ----------------

  function refrescarHud() {
    elCreditos.textContent = Juego.creditos();
    elNombreSala.textContent = Juego.salaActual().nombre;
  }

  function ponerModo(m) {
    Sala.modo(m);
    btnModo.textContent = (m === "decorar") ? "🚶 Pasear" : "🎨 Decorar";
    btnModo.classList.toggle("activo", m === "decorar");
    if (m === "pasear") {
      cancelarFantasma();
      cerrarPanel();
      ocultarMenuFurni();
    }
  }

  // ---------------- panel lateral ----------------

  function abrirPanel(nombre) {
    if (nombre !== "salas") ponerModoSinCerrar("decorar");
    panelAbierto = nombre;
    elPanel.classList.remove("oculto");
    document.querySelectorAll("#hud [data-panel]").forEach(function (b) {
      b.classList.toggle("activo", b.getAttribute("data-panel") === nombre);
    });
    if (nombre === "catalogo") pintarCatalogo();
    else if (nombre === "inventario") pintarInventario();
    else pintarSalas();
  }

  function ponerModoSinCerrar(m) {
    Sala.modo(m);
    btnModo.textContent = (m === "decorar") ? "🚶 Pasear" : "🎨 Decorar";
    btnModo.classList.toggle("activo", m === "decorar");
  }

  function cerrarPanel() {
    panelAbierto = null;
    elPanel.classList.add("oculto");
    document.querySelectorAll("#hud [data-panel]").forEach(function (b) {
      b.classList.remove("activo");
    });
  }

  function tarjetaFurni(f, extra) {
    var carta = document.createElement("div");
    carta.className = "carta";
    var cv = document.createElement("canvas");
    cv.width = 120;
    cv.height = 100;
    carta.appendChild(cv);
    var info = document.createElement("div");
    info.className = "carta-info";
    info.innerHTML = '<div class="nombre">' + f.nombre + '</div>';
    carta.appendChild(info);
    if (extra) info.appendChild(extra);
    Furnis.miniatura(cv, f.id);
    return carta;
  }

  // --- catálogo ---

  function pintarCatalogo() {
    elPanelTitulo.textContent = "🛒 Catálogo";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML = "";

    Furnis.categorias().forEach(function (c) {
      var hay = Furnis.lista().some(function (f) { return f.categoria === c[0]; });
      if (!hay) return;
      var b = document.createElement("button");
      b.textContent = c[1];
      b.classList.toggle("activo", c[0] === categoriaActiva);
      b.addEventListener("click", function () {
        categoriaActiva = c[0];
        pintarCatalogo();
      });
      elPanelPestanas.appendChild(b);
    });

    var rejilla = document.createElement("div");
    rejilla.className = "rejilla-panel";
    Furnis.lista().forEach(function (f) {
      if (f.categoria !== categoriaActiva) return;
      var extra = document.createElement("div");
      extra.className = "detalle";
      extra.innerHTML = '<span class="precio">' + f.precio + ' cr</span>';
      var carta = tarjetaFurni(f, extra);
      carta.classList.add("clicable");
      if (Juego.creditos() < f.precio) carta.classList.add("caro");
      carta.addEventListener("click", function () {
        if (Juego.creditos() < f.precio) {
          avisar("No tienes créditos suficientes", "error");
          return;
        }
        empezarColocacion(f.id, "catalogo");
      });
      rejilla.appendChild(carta);
    });
    elPanelContenido.appendChild(rejilla);
  }

  // --- inventario ---

  function pintarInventario() {
    elPanelTitulo.textContent = "📦 Inventario";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML = "";
    var inv = Juego.inventario();
    if (!inv.length) {
      elPanelContenido.innerHTML = '<p class="vacio">Tu inventario está vacío. Cuando guardes un mueble de la sala o compres sin colocar, aparecerá aquí.</p>';
      return;
    }
    var rejilla = document.createElement("div");
    rejilla.className = "rejilla-panel";
    inv.forEach(function (inst) {
      var f = Furnis.get(inst.id);
      var extra = document.createElement("div");
      extra.className = "detalle";
      var bVender = document.createElement("button");
      bVender.className = "mini";
      bVender.textContent = "Vender " + Juego.precioVenta(inst.id) + " cr";
      bVender.addEventListener("click", function (e) {
        e.stopPropagation();
        Juego.deInventario(inst.uid);
        var n = Juego.vender(inst.id);
        avisar("Vendido por " + n + " créditos", "ok");
        pintarInventario();
      });
      extra.appendChild(bVender);
      var carta = tarjetaFurni(f, extra);
      carta.classList.add("clicable");
      carta.addEventListener("click", function () {
        empezarColocacion(inst.id, "inventario", inst.uid);
      });
      rejilla.appendChild(carta);
    });
    elPanelContenido.appendChild(rejilla);
  }

  // --- salas ---

  function pintarSalas() {
    elPanelTitulo.textContent = "🚪 Mis salas";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML = "";

    Juego.salas().forEach(function (s, i) {
      var div = document.createElement("div");
      div.className = "sala-item" + (i === Juego.indiceSala() ? " actual" : "");
      var texto = '<div class="nombre">' + s.nombre + '</div>' +
                  '<div class="detalle">' + s.ancho + '×' + s.fondo + ' casillas</div>';
      div.innerHTML = texto;
      if (s.desbloqueada) {
        if (i !== Juego.indiceSala()) {
          var b = document.createElement("button");
          b.className = "mini";
          b.textContent = "Ir a la sala";
          b.addEventListener("click", function () {
            cancelarFantasma();
            Juego.cambiarSala(i);
            Sala.cargar(Juego.salaActual());
            refrescarHud();
            pintarSalas();
          });
          div.appendChild(b);
        }
      } else {
        var bd = document.createElement("button");
        bd.className = "mini dorado";
        bd.textContent = "Desbloquear · " + s.precio + " cr";
        bd.addEventListener("click", function () {
          if (Juego.desbloquearSala(i)) {
            avisar("¡Has desbloqueado " + s.nombre + "!", "ok");
            pintarSalas();
          } else {
            avisar("No tienes créditos suficientes", "error");
          }
        });
        div.appendChild(bd);
      }
      elPanelContenido.appendChild(div);
    });

    // colores de la sala actual
    var titulo = document.createElement("h3");
    titulo.textContent = "Colores de esta sala";
    elPanelContenido.appendChild(titulo);
    elPanelContenido.appendChild(filaColores("Suelo", COLORES_SUELO, "suelo"));
    elPanelContenido.appendChild(filaColores("Paredes", COLORES_PARED, "pared"));
  }

  function filaColores(etiqueta, colores, tipo) {
    var fila = document.createElement("div");
    fila.className = "fila-colores";
    var lab = document.createElement("span");
    lab.textContent = etiqueta;
    fila.appendChild(lab);
    var s = Juego.salaActual();
    colores.forEach(function (nombre) {
      var b = document.createElement("button");
      b.className = "muestra";
      b.style.background = Paleta.get(nombre).base;
      b.title = nombre;
      var actual = (tipo === "suelo") ? s.colorSuelo : s.colorPared;
      if (actual === nombre) b.classList.add("activo");
      b.addEventListener("click", function () {
        Juego.cambiarColor(tipo, nombre);
        pintarSalas();
      });
      fila.appendChild(b);
    });
    return fila;
  }

  // ---------------- colocación (fantasma) ----------------

  function empezarColocacion(id, origen, uid) {
    Sala.iniciarFantasma(id, 0, { origen: origen, uid: uid });
    elPistaFantasma.classList.remove("oculto");
    ocultarMenuFurni();
  }

  function cancelarFantasma() {
    if (movimiento) {
      // devolver el furni movido a su sitio original
      Juego.salaActual().furnis.push(movimiento);
      movimiento = null;
    }
    Sala.cancelarFantasma();
    elPistaFantasma.classList.add("oculto");
  }

  function alColocar(info) {
    var salaObj = Juego.salaActual();

    if (info.origen === "catalogo") {
      var inst = Juego.comprar(info.id);
      if (!inst) { avisar("No tienes créditos suficientes", "error"); return; }
      ponerEnSala(salaObj, inst, info);
      avisar("Comprado por " + Furnis.get(info.id).precio + " créditos", "ok");
      if (panelAbierto === "catalogo") pintarCatalogo();
    } else if (info.origen === "inventario") {
      var inst2 = Juego.deInventario(info.uid);
      if (!inst2) return;
      ponerEnSala(salaObj, inst2, info);
      if (panelAbierto === "inventario") pintarInventario();
    } else if (info.origen === "sala" && movimiento) {
      ponerEnSala(salaObj, movimiento, info);
      movimiento = null;
    }

    Sala.cancelarFantasma();
    elPistaFantasma.classList.add("oculto");
  }

  function ponerEnSala(salaObj, inst, info) {
    var f = { uid: inst.uid, id: inst.id };
    if (info.pared) {
      f.pared = info.pared;
      f.slot = info.slot;
    } else {
      f.x = info.x;
      f.y = info.y;
      f.rot = info.rot || 0;
    }
    salaObj.furnis.push(f);
  }

  // ---------------- menú del furni seleccionado ----------------

  function mostrarMenuFurni(f, punto) {
    var def = Furnis.get(f.id);
    elMenuFurni.classList.remove("oculto");
    var x = Math.max(10, Math.min(punto.x - 90, elMenuFurni.parentElement.clientWidth - 200));
    var y = Math.max(10, punto.y - 52);
    elMenuFurni.style.left = x + "px";
    elMenuFurni.style.top = y + "px";
    document.getElementById("btn-rotar").style.display =
      (def.rotaciones > 1 && !f.pared) ? "" : "none";
    document.getElementById("btn-vender").textContent =
      "💰 " + Juego.precioVenta(f.id) + " cr";
  }

  function ocultarMenuFurni() {
    elMenuFurni.classList.add("oculto");
  }

  function quitarDeSala(uid) {
    var lista = Juego.salaActual().furnis;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].uid === uid) return lista.splice(i, 1)[0];
    }
    return null;
  }

  function accionRotar(f) {
    if (!f || f.pared) return;
    var def = Furnis.get(f.id);
    var nuevo = ((f.rot || 0) + 1) % def.rotaciones;
    if (Sala.validar(f.id, f.x, f.y, nuevo, f.uid)) {
      f.rot = nuevo;
    } else {
      avisar("No cabe girado en ese sitio", "error");
    }
  }

  function accionMover(f) {
    Sala.levantarSiSentadoEn(f.uid);
    movimiento = quitarDeSala(f.uid);
    if (!movimiento) return;
    Sala.deseleccionar();
    if (movimiento.pared) {
      Sala.iniciarFantasma(movimiento.id, 0, { origen: "sala", uid: movimiento.uid });
    } else {
      Sala.iniciarFantasma(movimiento.id, movimiento.rot || 0, { origen: "sala", uid: movimiento.uid });
    }
    elPistaFantasma.classList.remove("oculto");
    ocultarMenuFurni();
  }

  function accionGuardar(f) {
    Sala.levantarSiSentadoEn(f.uid);
    var inst = quitarDeSala(f.uid);
    if (!inst) return;
    Juego.aInventario(inst);
    Sala.deseleccionar();
    ocultarMenuFurni();
    avisar("Guardado en el inventario", "ok");
  }

  function accionVender(f) {
    Sala.levantarSiSentadoEn(f.uid);
    var inst = quitarDeSala(f.uid);
    if (!inst) return;
    var n = Juego.vender(inst.id);
    Sala.deseleccionar();
    ocultarMenuFurni();
    avisar("Vendido por " + n + " créditos", "ok");
  }

  // ---------------- arranque ----------------

  function iniciar() {
    elCreditos = document.getElementById("hud-creditos");
    elNombreSala = document.getElementById("hud-sala");
    elPanel = document.getElementById("panel");
    elPanelTitulo = document.getElementById("panel-titulo");
    elPanelPestanas = document.getElementById("panel-pestanas");
    elPanelContenido = document.getElementById("panel-contenido");
    elMenuFurni = document.getElementById("menu-furni");
    elAvisos = document.getElementById("avisos");
    elPistaFantasma = document.getElementById("pista-fantasma");
    btnModo = document.getElementById("btn-modo");

    Juego.ponAlCambiar(refrescarHud);

    // botones del HUD
    btnModo.addEventListener("click", function () {
      ponerModo(Sala.modo() === "decorar" ? "pasear" : "decorar");
    });
    document.querySelectorAll("#hud [data-panel]").forEach(function (b) {
      b.addEventListener("click", function () {
        var nombre = b.getAttribute("data-panel");
        if (panelAbierto === nombre) cerrarPanel();
        else abrirPanel(nombre);
      });
    });
    document.getElementById("panel-cerrar").addEventListener("click", cerrarPanel);

    // menú del furni
    document.getElementById("btn-rotar").addEventListener("click", function () {
      accionRotar(Sala.seleccionado());
    });
    document.getElementById("btn-mover").addEventListener("click", function () {
      var f = Sala.seleccionado();
      if (f) accionMover(f);
    });
    document.getElementById("btn-guardar").addEventListener("click", function () {
      var f = Sala.seleccionado();
      if (f) accionGuardar(f);
    });
    document.getElementById("btn-vender").addEventListener("click", function () {
      var f = Sala.seleccionado();
      if (f) accionVender(f);
    });

    // callbacks del motor
    Sala.enlazar({
      alColocar: alColocar,
      alCancelarFantasma: cancelarFantasma,
      alSeleccionar: function (f, punto) {
        if (f && punto) mostrarMenuFurni(f, punto);
        else ocultarMenuFurni();
      },
      alRotar: accionRotar
    });

    refrescarHud();
  }

  return {
    iniciar: iniciar,
    abrirPanel: abrirPanel,
    cerrarPanel: cerrarPanel,
    ponerModo: ponerModo,
    empezarColocacion: empezarColocacion,
    avisar: avisar
  };
})();
