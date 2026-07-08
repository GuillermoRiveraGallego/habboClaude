"use strict";

// ============================================================
// UI — interfaz del juego: HUD (créditos, botones), panel
// lateral (catálogo / inventario / salas), menú del furni
// seleccionado y avisos. Orquesta Juego (estado) y Sala (motor).
// ============================================================
var UI = (function () {

  var elCreditos, elNombreSala, elPanel, elPanelTitulo, elPanelPestanas,
      elPanelContenido, elMenuFurni, elAvisos, elPistaFantasma, btnModo,
      elPanelMascota, elPanelChat, elChatMensajes, elChatInput,
      elBarraColoc, elBcRotar, elBcCancelar, elBcColocar;

  var panelAbierto = null;      // "catalogo" | "inventario" | "salas" | "mascotas" | "tareas" | null
  var chatNpc = null;           // NPC con el chat abierto
  var categoriaActiva = "mesas";
  var movimiento = null;        // furni retirado de la sala mientras se mueve
  var pestanaMascotas = "mias"; // "mias" | "tienda"
  var mascotaAbierta = null;    // uid de la mascota del panel flotante

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
    pintarBotonModo(m);
    if (m === "pasear") {
      cancelarFantasma();
      cerrarPanel();
      ocultarMenuFurni();
    }
  }

  // ---------------- panel lateral ----------------

  function abrirPanel(nombre, sub) {
    if (nombre !== "salas" && nombre !== "mascotas" && nombre !== "avatar" &&
        nombre !== "tareas") {
      ponerModoSinCerrar("decorar");
    }
    panelAbierto = nombre;
    if (sub) pestanaMascotas = sub;
    elPanel.classList.remove("oculto");
    document.querySelectorAll("#hud [data-panel]").forEach(function (b) {
      b.classList.toggle("activo", b.getAttribute("data-panel") === nombre);
    });
    if (nombre === "catalogo") pintarCatalogo();
    else if (nombre === "inventario") pintarInventario();
    else if (nombre === "mascotas") pintarMascotas();
    else if (nombre === "avatar") pintarAvatar();
    else if (nombre === "tareas") pintarTareas();
    else pintarSalas();
  }

  function ponerModoSinCerrar(m) {
    Sala.modo(m);
    pintarBotonModo(m);
  }

  // la etiqueta va en un span para poder ocultarla en pantallas estrechas
  function pintarBotonModo(m) {
    btnModo.innerHTML = (m === "decorar")
      ? '🚶 <span class="etiqueta">Pasear</span>'
      : '🎨 <span class="etiqueta">Decorar</span>';
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

  // En el casino solo se ve (y se usa) el mobiliario del casino;
  // fuera de él, ese mobiliario desaparece del catálogo y del
  // inventario (la exclusividad la valida también Sala.validar).
  function esSalaCasino() {
    return Juego.salaActual().tipo === "casino";
  }

  function enZonaActual(f) {
    return esSalaCasino() ? f.zona === "casino" : f.zona !== "casino";
  }

  function pintarCatalogo() {
    elPanelTitulo.textContent = esSalaCasino() ? "🎰 Catálogo del casino" : "🛒 Catálogo";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML = "";

    var visibles = Furnis.lista().filter(enZonaActual);
    var cats = Furnis.categorias().filter(function (c) {
      return visibles.some(function (f) { return f.categoria === c[0]; });
    });
    if (!cats.some(function (c) { return c[0] === categoriaActiva; }) && cats.length) {
      categoriaActiva = cats[0][0];
    }
    cats.forEach(function (c) {
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
    visibles.forEach(function (f) {
      if (f.categoria !== categoriaActiva) return;
      // furnis de recompensa: visibles pero bloqueados hasta
      // conseguirlos (tareas diarias o mascotas felices)
      var bloqueado = f.recompensa && !Juego.recompensas()[f.id];
      var extra = document.createElement("div");
      extra.className = "detalle";
      if (bloqueado) {
        extra.innerHTML = '<span class="candado">🔒 ' +
          (f.desbloqueo || "Recompensa especial") + '</span>';
      } else {
        extra.innerHTML = f.recompensa
          ? '<span class="precio">🎁 Recompensa conseguida</span>'
          : '<span class="precio">' + f.precio + ' cr</span>';
      }
      var carta = tarjetaFurni(f, extra);
      if (bloqueado) {
        carta.classList.add("bloqueada");
      } else {
        carta.classList.add("clicable");
        if (Juego.creditos() < f.precio) carta.classList.add("caro");
        carta.addEventListener("click", function () {
          if (Juego.creditos() < f.precio) {
            avisar("No tienes créditos suficientes", "error");
            return;
          }
          empezarColocacion(f.id, "catalogo");
        });
      }
      rejilla.appendChild(carta);
    });
    elPanelContenido.appendChild(rejilla);
  }

  // --- inventario ---

  function pintarInventario() {
    elPanelTitulo.textContent = esSalaCasino() ? "🎰 Inventario del casino" : "📦 Inventario";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML = "";
    var inv = Juego.inventario().filter(function (inst) {
      return enZonaActual(Furnis.get(inst.id));
    });
    var ocultos = Juego.inventario().length - inv.length;
    if (!inv.length) {
      elPanelContenido.innerHTML = esSalaCasino()
        ? '<p class="vacio">No tienes muebles del casino guardados. Aquí solo se usan los muebles del casino; los demás te esperan fuera.</p>'
        : '<p class="vacio">Tu inventario está vacío. Cuando guardes un mueble de la sala o compres sin colocar, aparecerá aquí.</p>' +
          (ocultos ? '<p class="vacio">(' + ocultos + ' mueble' + (ocultos > 1 ? 's' : '') +
            ' del casino guardados: se ven al entrar al casino)</p>' : '');
      return;
    }
    if (ocultos) {
      var nota = document.createElement("p");
      nota.className = "vacio";
      nota.textContent = esSalaCasino()
        ? "Solo se muestran los muebles del casino (" + ocultos + " normales ocultos)"
        : "Los muebles del casino (" + ocultos + ") se ven al entrar al casino";
      elPanelContenido.appendChild(nota);
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
      var texto = '<div class="nombre">' +
                  (s.tipo === "jardin" ? "🌳 " : s.tipo === "casino" ? "🎰 " : "") + s.nombre + '</div>' +
                  '<div class="detalle">' + s.ancho + '×' + s.fondo + ' casillas' +
                  (s.tipo === "jardin" ? ' · zona exterior, hogar de tus mascotas' :
                   s.tipo === "casino" ? ' · juegos de apuestas con tus créditos' : '') + '</div>';
      div.innerHTML = texto;
      if (s.desbloqueada) {
        if (i !== Juego.indiceSala()) {
          var b = document.createElement("button");
          b.className = "mini";
          b.textContent = "Ir a la sala";
          b.addEventListener("click", function () {
            cancelarFantasma();
            cerrarPanelMascota();
            cerrarChat();
            if (window.Casino) Casino.cerrar();
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

    // colores de la sala actual (el jardín es césped y setos;
    // el casino tiene su moqueta y sus maderas fijas)
    if (Juego.salaActual().tipo !== "jardin" && Juego.salaActual().tipo !== "casino") {
      var titulo = document.createElement("h3");
      titulo.textContent = "Colores de esta sala";
      elPanelContenido.appendChild(titulo);
      elPanelContenido.appendChild(filaColores("Suelo", COLORES_SUELO, "suelo"));
      elPanelContenido.appendChild(filaColores("Paredes", COLORES_PARED, "pared"));
    }

    // reiniciar la partida (borra el guardado)
    var hReset = document.createElement("h3");
    hReset.textContent = "Zona de peligro";
    elPanelContenido.appendChild(hReset);
    var bReset = document.createElement("button");
    bReset.className = "mini";
    bReset.id = "btn-reiniciar";
    bReset.textContent = "🗑 Reiniciar partida (borra todo)";
    bReset.addEventListener("click", function () {
      Dialogo.confirmar({
        titulo: "🗑 Reiniciar partida",
        mensaje: "¿Seguro que quieres reiniciar? Se borrarán salas, furnis, " +
          "mascotas, créditos y avatar. No se puede deshacer.",
        aceptar: "Sí, borrar todo",
        cancelar: "Cancelar",
        peligro: true,
        alAceptar: function () {
          if (window.Guardado) Guardado.reiniciar();
          location.reload();
        }
      });
    });
    elPanelContenido.appendChild(bReset);
  }

  // ---------------- panel del avatar ----------------

  var previewDir = 1;

  var COLORES_PELO = ["negro", "madera_oscura", "madera", "amarillo", "naranja", "gris", "rojo", "morado"];
  var COLORES_PIEL = ["piel", "crema", "beige", "madera", "marron"];
  var COLORES_CAMISETA = ["turquesa", "rojo", "azul", "verde", "amarillo", "naranja", "morado", "rosa", "blanco", "gris", "negro"];
  var COLORES_PANTALON = ["gris_oscuro", "azul", "negro", "marron", "verde_oscuro", "beige", "blanco"];
  var COLORES_ZAPATOS = ["negro", "blanco", "marron", "rojo", "gris_oscuro", "azul"];

  function pintarAvatar() {
    elPanelTitulo.textContent = "👤 Tu avatar";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML = "";

    // vista previa
    var prev = document.createElement("div");
    prev.className = "avatar-preview";
    var cv = document.createElement("canvas");
    cv.width = 170;
    cv.height = 190;
    prev.appendChild(cv);
    var bGirar = document.createElement("button");
    bGirar.className = "mini";
    bGirar.textContent = "↻ Girar";
    bGirar.addEventListener("click", function () {
      previewDir = (previewDir + 1) % 4;
      Avatar.miniatura(cv, previewDir);
    });
    prev.appendChild(bGirar);
    elPanelContenido.appendChild(prev);

    // peinados
    var h = document.createElement("h3");
    h.textContent = "Peinado";
    h.style.marginTop = "4px";
    elPanelContenido.appendChild(h);
    var chips = document.createElement("div");
    chips.className = "fila-chips";
    Avatar.PEINADOS.forEach(function (p) {
      var b = document.createElement("button");
      b.className = "mini" + (Juego.aspecto().peinado === p[0] ? " activo" : "");
      b.textContent = p[1];
      b.addEventListener("click", function () {
        Juego.cambiarAspecto("peinado", p[0]);
        pintarAvatar();
      });
      chips.appendChild(b);
    });
    elPanelContenido.appendChild(chips);

    // colores
    elPanelContenido.appendChild(filaAspecto("Pelo", "pelo", COLORES_PELO, cv));
    elPanelContenido.appendChild(filaAspecto("Piel", "piel", COLORES_PIEL, cv));
    elPanelContenido.appendChild(filaAspecto("Camiseta", "camiseta", COLORES_CAMISETA, cv));
    elPanelContenido.appendChild(filaAspecto("Pantalón", "pantalon", COLORES_PANTALON, cv));
    elPanelContenido.appendChild(filaAspecto("Zapatos", "zapatos", COLORES_ZAPATOS, cv));

    Avatar.miniatura(cv, previewDir);
  }

  function filaAspecto(etiqueta, clave, colores, cv) {
    var fila = document.createElement("div");
    fila.className = "fila-colores";
    var lab = document.createElement("span");
    lab.textContent = etiqueta;
    fila.appendChild(lab);
    colores.forEach(function (nombre) {
      var b = document.createElement("button");
      b.className = "muestra";
      b.style.background = Paleta.get(nombre).base;
      b.title = nombre;
      if (Juego.aspecto()[clave] === nombre) b.classList.add("activo");
      b.addEventListener("click", function () {
        Juego.cambiarAspecto(clave, nombre);
        fila.querySelectorAll(".muestra").forEach(function (m) { m.classList.remove("activo"); });
        b.classList.add("activo");
        Avatar.miniatura(cv, previewDir);
      });
      fila.appendChild(b);
    });
    return fila;
  }

  // ---------------- panel de mascotas ----------------

  function barra(etiqueta, valor, clase) {
    return '<div class="fila-barra"><span>' + etiqueta + '</span>' +
      '<div class="barra"><div class="relleno ' + clase + '" style="width:' +
      Math.round(valor) + '%"></div></div></div>';
  }

  function barrasDe(m) {
    return barra("Hambre", m.hambre, "b-hambre") +
           barra("Felicidad", m.felicidad, "b-felicidad") +
           barra("Energía", m.energia, "b-energia");
  }

  function pintarMascotas() {
    elPanelTitulo.textContent = "🐾 Mascotas";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML = "";

    [["mias", "Mis mascotas"], ["tienda", "Tienda"]].forEach(function (t) {
      var b = document.createElement("button");
      b.textContent = t[1];
      b.classList.toggle("activo", pestanaMascotas === t[0]);
      b.addEventListener("click", function () {
        pestanaMascotas = t[0];
        pintarMascotas();
      });
      elPanelPestanas.appendChild(b);
    });

    if (pestanaMascotas === "mias") pintarMisMascotas();
    else pintarTienda();
  }

  function pintarMisMascotas() {
    var lista = Juego.mascotas();
    var media = Mascotas.felicidadGlobal();
    if (media !== null) {
      var cab = document.createElement("div");
      cab.className = "jardin-global";
      cab.innerHTML = "Felicidad del jardín: <b>" + media + "%</b>" +
        '<div class="barra"><div class="relleno b-felicidad" style="width:' + media + '%"></div></div>' +
        '<div class="detalle">Con 3+ mascotas al 80% (y 5+ al 85%) desbloqueas regalos exclusivos</div>';
      elPanelContenido.appendChild(cab);
    }
    if (!lista.length) {
      elPanelContenido.innerHTML +=
        '<p class="vacio">Aún no tienes mascotas. Desbloquea El Jardín y pásate por la pestaña Tienda 🐕</p>';
      return;
    }
    lista.forEach(function (m) {
      var t = Mascotas.TIPOS[m.tipo];
      var div = document.createElement("div");
      div.className = "carta-mascota";
      var cv = document.createElement("canvas");
      cv.width = 78;
      cv.height = 66;
      div.appendChild(cv);
      var info = document.createElement("div");
      info.className = "mascota-info";
      info.innerHTML = '<div class="nombre">' + m.nombre + " " +
        Mascotas.emojiEstado(Mascotas.estadoDe(m)) + '</div>' +
        '<div class="detalle">' + t.nombre + '</div>' +
        '<div data-barras="' + m.uid + '">' + barrasDe(m) + '</div>';
      div.appendChild(info);
      var acciones = document.createElement("div");
      acciones.className = "mascota-acciones";
      var bA = document.createElement("button");
      bA.className = "mini";
      bA.textContent = "🍖 (" + (Juego.comida()[m.tipo] || 0) + ")";
      bA.title = "Alimentar";
      bA.addEventListener("click", function () {
        var r = Mascotas.alimentar(m);
        avisar(r.ok ? m.nombre + " ha comido a gusto" : r.error, r.ok ? "ok" : "error");
        pintarMascotas();
      });
      var bJ = document.createElement("button");
      bJ.className = "mini";
      bJ.textContent = "🎾";
      bJ.title = "Jugar";
      bJ.addEventListener("click", function () {
        var r = Mascotas.jugar(m);
        avisar(r.ok ? "¡" + m.nombre + " se lo pasa en grande!" : r.error, r.ok ? "ok" : "error");
        pintarMascotas();
      });
      acciones.appendChild(bA);
      acciones.appendChild(bJ);
      div.appendChild(acciones);
      elPanelContenido.appendChild(div);
      Mascotas.miniatura(cv, m.tipo);
    });
  }

  function pintarTienda() {
    var h = document.createElement("h3");
    h.textContent = "Animales";
    h.style.marginTop = "4px";
    elPanelContenido.appendChild(h);

    var rejilla = document.createElement("div");
    rejilla.className = "rejilla-panel";
    Object.keys(Mascotas.TIPOS).forEach(function (tipo) {
      var t = Mascotas.TIPOS[tipo];
      var carta = document.createElement("div");
      carta.className = "carta clicable";
      var cv = document.createElement("canvas");
      cv.width = 120;
      cv.height = 90;
      carta.appendChild(cv);
      var req = t.hogar
        ? (tipo === "pez" ? "Necesita acuario en el jardín" : "Necesita aviario en el jardín")
        : "Pasea libre por el jardín";
      var info = document.createElement("div");
      info.className = "carta-info";
      info.innerHTML = '<div class="nombre">' + t.emoji + " " + t.nombre +
        '</div><div class="detalle"><span class="precio">' + t.precio + ' cr</span><br>' + req + '</div>';
      carta.appendChild(info);
      carta.addEventListener("click", function () { comprarMascota(tipo); });
      rejilla.appendChild(carta);
      Mascotas.miniatura(cv, tipo);
    });
    elPanelContenido.appendChild(rejilla);

    var h2 = document.createElement("h3");
    h2.textContent = "Comida (tu despensa)";
    elPanelContenido.appendChild(h2);
    Object.keys(Mascotas.COMIDA).forEach(function (tipo) {
      var c = Mascotas.COMIDA[tipo];
      var fila = document.createElement("div");
      fila.className = "fila-comida";
      fila.innerHTML = '<span>' + c.nombre + '</span>' +
        '<span class="detalle">tienes ' + (Juego.comida()[tipo] || 0) + '</span>';
      var b = document.createElement("button");
      b.className = "mini dorado";
      b.textContent = c.precio + " cr";
      b.addEventListener("click", function () {
        if (!Juego.gastar(c.precio)) {
          avisar("No tienes créditos suficientes", "error");
          return;
        }
        Juego.agregarComida(tipo);
        avisar(c.nombre + " añadida a la despensa", "ok");
        pintarMascotas();
      });
      fila.appendChild(b);
      elPanelContenido.appendChild(fila);
    });
  }

  function comprarMascota(tipo) {
    var r = Mascotas.puedeComprar(tipo);
    if (!r.ok) { avisar(r.error, "error"); return; }
    var t = Mascotas.TIPOS[tipo];
    var sug = t.sugerencias[(Math.random() * t.sugerencias.length) | 0];
    Dialogo.pedir({
      titulo: t.emoji + " Nueva mascota",
      mensaje: "¿Cómo se llamará tu " + t.nombre.toLowerCase() + "?",
      valor: sug,
      placeholder: sug,
      maxlargo: 16,
      aceptar: "Adoptar",
      alAceptar: function (texto) {
        var nombre = (texto || sug).trim().slice(0, 16) || sug;
        var res = Mascotas.comprar(tipo, nombre);
        if (!res.ok) { avisar(res.error, "error"); return; }
        avisar("¡" + res.mascota.nombre + " se ha unido al jardín!", "ok");
        pintarMascotas();
      }
    });
  }

  // panel flotante al pulsar una mascota en el jardín
  function abrirPanelMascota(m, punto) {
    mascotaAbierta = m.uid;
    elPanelMascota.classList.remove("oculto");
    var zona = elPanelMascota.parentElement;
    var x = Math.max(10, Math.min((punto ? punto.x : 200) - 110, zona.clientWidth - 240));
    var y = Math.max(10, (punto ? punto.y : 150) - 175);
    elPanelMascota.style.left = x + "px";
    elPanelMascota.style.top = y + "px";
    refrescarPanelMascota();
  }

  function cerrarPanelMascota() {
    mascotaAbierta = null;
    elPanelMascota.classList.add("oculto");
  }

  function mascotaPorUid(uid) {
    var lista = Juego.mascotas();
    for (var i = 0; i < lista.length; i++) if (lista[i].uid === uid) return lista[i];
    return null;
  }

  function refrescarPanelMascota() {
    var m = mascotaPorUid(mascotaAbierta);
    if (!m) { cerrarPanelMascota(); return; }
    var t = Mascotas.TIPOS[m.tipo];
    var e = Mascotas.estadoDe(m);
    document.getElementById("pm-titulo").innerHTML =
      t.emoji + " <b>" + m.nombre + "</b> · " +
      (e === "contento" ? "Contento" : e === "normal" ? "Normal" : "Triste") +
      " " + Mascotas.emojiEstado(e);
    document.getElementById("pm-barras").innerHTML = barrasDe(m);
    document.getElementById("pm-alimentar").textContent =
      "🍖 Alimentar (" + (Juego.comida()[m.tipo] || 0) + ")";
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

  // ---------------- tareas diarias ----------------

  function formatear(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function pintarTareas() {
    elPanelTitulo.textContent = "📋 Tareas diarias";
    elPanelPestanas.innerHTML = "";
    elPanelContenido.innerHTML =
      '<p class="vacio">Cinco retos nuevos cada día. Se renuevan a medianoche.</p>';

    Tareas.lista().forEach(function (t) {
      var estadoT = Tareas.estadoDe(t.id);
      var prog = Tareas.progresoDe(t.id);
      var pct = Math.min(100, Math.round(prog / t.meta * 100));
      var div = document.createElement("div");
      div.className = "tarea" +
        (estadoT === "completada" ? " completada" :
         estadoT === "reclamada" ? " reclamada" : "");
      div.innerHTML =
        '<div class="cabecera"><span>' + t.icono + '</span><span>' + t.nombre + '</span></div>' +
        '<div class="detalle">' + t.desc +
        (t.desbloquea ? ' · 🎁 ' + t.desbloquea.regalo : '') + '</div>' +
        '<div class="fila-barra"><span>' + formatear(prog) + ' / ' + formatear(t.meta) + '</span>' +
        '<div class="barra"><div class="relleno b-tarea" style="width:' + pct + '%"></div></div></div>';
      if (estadoT === "completada") {
        var b = document.createElement("button");
        b.className = "mini dorado";
        b.textContent = "🎉 Reclamar " + formatear(t.recompensa) + " cr";
        b.addEventListener("click", function () {
          if (!Tareas.reclamar(t.id)) return;
          avisar("+" + formatear(t.recompensa) + " créditos · " + t.nombre, "ok");
          if (t.desbloquea) avisar(t.desbloquea.aviso, "ok");
          pintarTareas();
        });
        div.appendChild(b);
      } else if (estadoT === "reclamada") {
        div.innerHTML += '<div class="premio">✔ Recompensa recibida</div>';
      } else {
        div.innerHTML += '<div class="premio">Premio: ' + formatear(t.recompensa) + ' cr</div>';
      }
      elPanelContenido.appendChild(div);
    });
  }

  // ---------------- chat con NPCs ----------------

  function burbuja(quien, texto) {
    var div = document.createElement("div");
    div.className = "burbuja " + quien;
    div.textContent = texto;
    elChatMensajes.appendChild(div);
    elChatMensajes.scrollTop = elChatMensajes.scrollHeight;
  }

  function abrirChat(npc) {
    chatNpc = npc;
    cerrarPanelMascota();
    elPanelChat.classList.remove("oculto");
    document.getElementById("chat-titulo").textContent = npc.emoji + " " + npc.nombre;
    elChatMensajes.innerHTML = "";
    burbuja("npc", Npcs.saludoDe(npc));
    if (window.Tareas) Tareas.evento("npc", npc.id);
    elChatInput.value = "";
    elChatInput.focus();
  }

  function cerrarChat() {
    chatNpc = null;
    elPanelChat.classList.add("oculto");
  }

  function enviarChat() {
    var texto = elChatInput.value.trim();
    if (!texto || !chatNpc) return;
    burbuja("jugador", texto);
    elChatInput.value = "";
    var npc = chatNpc;
    var respuesta = Npcs.responder(npc, texto);
    // pequeña pausa para que parezca que piensa
    setTimeout(function () {
      if (chatNpc === npc) burbuja("npc", respuesta);
    }, 500 + Math.random() * 500);
  }

  // ---------------- colocación (fantasma) ----------------

  function esMovilUI() {
    return document.body.classList.contains("movil");
  }

  // Muestra las ayudas de colocación: la pista de teclado en escritorio y
  // la barra flotante (⟳ · ✖ · ✔) en móvil. En móvil, además, cierra el
  // panel para que se vea la sala y centra el fantasma para que aparezca
  // ya en pantalla. Qué se ve realmente lo decide el CSS por breakpoint.
  function mostrarColocacion(pref) {
    var fant = Sala.fantasmaActual();
    var def = fant && Furnis.get(fant.id);
    if (elBcRotar) {
      elBcRotar.style.display =
        (def && def.rotaciones > 1 && def.capa !== "pared") ? "" : "none";
    }
    if (esMovilUI()) {
      cerrarPanel();
      Sala.centrarFantasma(pref);
    }
    elPistaFantasma.classList.remove("oculto");
    if (elBarraColoc) elBarraColoc.classList.remove("oculto");
    actualizarBarraColoc(Sala.fantasmaValido());
    ocultarMenuFurni();
  }

  function ocultarColocacion() {
    elPistaFantasma.classList.add("oculto");
    if (elBarraColoc) elBarraColoc.classList.add("oculto");
  }

  // refleja la validez de la posición actual en el botón ✔ Colocar
  function actualizarBarraColoc(valido) {
    if (!elBcColocar) return;
    elBcColocar.disabled = !valido;
    elBcColocar.classList.toggle("bc-listo", !!valido);
  }

  function empezarColocacion(id, origen, uid) {
    Sala.iniciarFantasma(id, 0, { origen: origen, uid: uid });
    mostrarColocacion();
  }

  function cancelarFantasma() {
    if (movimiento) {
      // devolver el furni movido a su sitio original
      Juego.salaActual().furnis.push(movimiento);
      movimiento = null;
    }
    Sala.cancelarFantasma();
    ocultarColocacion();
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
    ocultarColocacion();
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

  function esFijo(f) {
    if (f && f.fijo) {
      avisar("El ordenador vino con la casa: no se puede tocar", "error");
      return true;
    }
    return false;
  }

  function accionRotar(f) {
    if (!f || f.pared || esFijo(f)) return;
    var def = Furnis.get(f.id);
    var nuevo = ((f.rot || 0) + 1) % def.rotaciones;
    if (Sala.validar(f.id, f.x, f.y, nuevo, f.uid)) {
      f.rot = nuevo;
    } else {
      avisar("No cabe girado en ese sitio", "error");
    }
  }

  function accionMover(f) {
    if (esFijo(f)) return;
    Sala.levantarSiSentadoEn(f.uid);
    movimiento = quitarDeSala(f.uid);
    if (!movimiento) return;
    Sala.deseleccionar();
    var pref;
    if (movimiento.pared) {
      Sala.iniciarFantasma(movimiento.id, 0, { origen: "sala", uid: movimiento.uid });
      pref = { pared: movimiento.pared, slot: movimiento.slot };
    } else {
      Sala.iniciarFantasma(movimiento.id, movimiento.rot || 0, { origen: "sala", uid: movimiento.uid });
      pref = { x: movimiento.x, y: movimiento.y };
    }
    // en móvil el fantasma reaparece en el sitio original del mueble
    mostrarColocacion(pref);
  }

  function hogarHabitado(f) {
    if (window.Mascotas && Mascotas.habitantesDe(f.uid).length) {
      avisar("¡Ahí viven tus mascotas! No puedes quitarlo", "error");
      return true;
    }
    return false;
  }

  function accionGuardar(f) {
    if (esFijo(f) || hogarHabitado(f)) return;
    Sala.levantarSiSentadoEn(f.uid);
    var inst = quitarDeSala(f.uid);
    if (!inst) return;
    Juego.aInventario(inst);
    Sala.deseleccionar();
    ocultarMenuFurni();
    avisar("Guardado en el inventario", "ok");
  }

  function accionVender(f) {
    if (esFijo(f) || hogarHabitado(f)) return;
    Sala.levantarSiSentadoEn(f.uid);
    var inst = quitarDeSala(f.uid);
    if (!inst) return;
    var n = Juego.vender(inst.id);
    Sala.deseleccionar();
    ocultarMenuFurni();
    avisar("Vendido por " + n + " créditos", "ok");
  }

  function refrescarBarrasLista() {
    document.querySelectorAll("[data-barras]").forEach(function (el) {
      var m = mascotaPorUid(parseInt(el.getAttribute("data-barras"), 10));
      if (m) el.innerHTML = barrasDe(m);
    });
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
    elBarraColoc = document.getElementById("barra-colocacion");
    elBcRotar = document.getElementById("bc-rotar");
    elBcCancelar = document.getElementById("bc-cancelar");
    elBcColocar = document.getElementById("bc-colocar");
    btnModo = document.getElementById("btn-modo");
    elPanelMascota = document.getElementById("panel-mascota");
    elPanelChat = document.getElementById("panel-chat");
    elChatMensajes = document.getElementById("chat-mensajes");
    elChatInput = document.getElementById("chat-input");

    Juego.ponAlCambiar(refrescarHud);

    // botones del HUD
    btnModo.addEventListener("click", function () {
      ponerModo(Sala.modo() === "decorar" ? "pasear" : "decorar");
    });
    // ciclo día/noche
    var btnAmbiente = document.getElementById("btn-ambiente");
    if (btnAmbiente && window.Ambiente) {
      btnAmbiente.addEventListener("click", function () {
        Ambiente.siguiente();
      });
      Ambiente.ponAlCambiar(function () {
        btnAmbiente.textContent = Ambiente.etiqueta();
      });
    }
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

    // barra flotante de colocación (móvil): ⟳ · ✖ Cancelar · ✔ Colocar
    if (elBcRotar) {
      elBcRotar.addEventListener("click", function () { Sala.rotarFantasma(); });
    }
    if (elBcCancelar) {
      elBcCancelar.addEventListener("click", cancelarFantasma);
    }
    if (elBcColocar) {
      elBcColocar.addEventListener("click", function () {
        if (!Sala.confirmarFantasma()) avisar("Ahí no cabe: prueba otro sitio", "error");
      });
    }

    // panel flotante de mascota
    document.getElementById("pm-cerrar").addEventListener("click", cerrarPanelMascota);
    document.getElementById("pm-alimentar").addEventListener("click", function () {
      var m = mascotaPorUid(mascotaAbierta);
      if (!m) return;
      var r = Mascotas.alimentar(m);
      avisar(r.ok ? m.nombre + " ha comido a gusto" : r.error, r.ok ? "ok" : "error");
      refrescarPanelMascota();
    });
    document.getElementById("pm-jugar").addEventListener("click", function () {
      var m = mascotaPorUid(mascotaAbierta);
      if (!m) return;
      var r = Mascotas.jugar(m);
      avisar(r.ok ? "¡" + m.nombre + " se lo pasa en grande!" : r.error, r.ok ? "ok" : "error");
      refrescarPanelMascota();
    });

    // chat con NPCs
    document.getElementById("chat-cerrar").addEventListener("click", cerrarChat);
    document.getElementById("chat-enviar").addEventListener("click", enviarChat);
    elChatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") enviarChat();
      else if (e.key === "Escape") cerrarChat();
    });

    // tareas diarias: avisos de completado y repintado en vivo
    if (window.Tareas) {
      Tareas.ponAlCambiar(function (def, recienCompletada) {
        if (recienCompletada) {
          avisar("✅ Tarea completada: " + def.nombre + " — reclama tu premio en 📋", "ok");
        }
        if (panelAbierto === "tareas") pintarTareas();
      });
    }

    // recompensas del jardín
    if (window.Mascotas) {
      Mascotas.ponAlRecompensa(function (id, mensaje) {
        avisar(mensaje, "ok");
        if (panelAbierto === "catalogo") pintarCatalogo();
      });
    }

    // las barras de las mascotas cambian en vivo
    setInterval(function () {
      if (mascotaAbierta !== null && !elPanelMascota.classList.contains("oculto")) {
        refrescarPanelMascota();
      }
      if (panelAbierto === "mascotas" && pestanaMascotas === "mias") {
        refrescarBarrasLista();
      }
    }, 600);

    // callbacks del motor
    Sala.enlazar({
      alColocar: alColocar,
      alCancelarFantasma: cancelarFantasma,
      alFantasmaMovido: actualizarBarraColoc,
      alSeleccionar: function (f, punto) {
        if (f && f.fijo) {
          avisar("El ordenador vino con la casa: no se puede tocar", "error");
          ocultarMenuFurni();
          Sala.deseleccionar();
          return;
        }
        if (f && punto) mostrarMenuFurni(f, punto);
        else ocultarMenuFurni();
      },
      alRotar: accionRotar,
      alMascota: abrirPanelMascota,
      alNpc: abrirChat,
      alOrdenador: function () {
        if (window.Minijuegos) Minijuegos.abrir();
      },
      alCasino: function (juego) {
        if (window.Casino) Casino.abrir(juego);
      }
    });

    // ---- reglas de cierre unificadas (fase POLISH) ----
    // Los modales (ordenador, casino, cuenta, diálogos) ya las traen de
    // Modal. Aquí damos a los paneles/overlays sin backdrop las MISMAS
    // reglas: ✕ (ya cableado), Escape y clic/toque fuera.
    if (window.Modal) {
      // colocación activa: Escape la cancela antes que ningún panel
      Modal.registrarPanel({
        nivel: 3,
        estaAbierto: function () { return Sala.hayFantasma(); },
        cerrar: cancelarFantasma,
        fueraCierra: false
      });
      // panel lateral: clic fuera cierra, salvo mientras se coloca un
      // mueble (en escritorio el panel debe seguir abierto para colocar)
      Modal.registrarPanel({
        estaAbierto: function () { return panelAbierto !== null; },
        cerrar: cerrarPanel,
        esParte: function (n) { return elPanel.contains(n); },
        esDisparador: function (n) {
          return !!(n.closest && n.closest("#hud, #movil-top, #movil-drawer, #movil-drawer-fondo"));
        },
        puedeCerrarFuera: function () { return !Sala.hayFantasma(); }
      });
      // panel flotante de mascota
      Modal.registrarPanel({
        estaAbierto: function () { return !elPanelMascota.classList.contains("oculto"); },
        cerrar: cerrarPanelMascota,
        esParte: function (n) { return elPanelMascota.contains(n); }
      });
      // chat con NPCs
      Modal.registrarPanel({
        estaAbierto: function () { return chatNpc !== null; },
        cerrar: cerrarChat,
        esParte: function (n) { return elPanelChat.contains(n); }
      });
    }

    refrescarHud();
  }

  return {
    iniciar: iniciar,
    abrirPanel: abrirPanel,
    cerrarPanel: cerrarPanel,
    ponerModo: ponerModo,
    empezarColocacion: empezarColocacion,
    abrirPanelMascota: abrirPanelMascota,
    abrirChat: abrirChat,
    avisar: avisar
  };
})();
