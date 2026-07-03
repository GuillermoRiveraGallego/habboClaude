"use strict";

// ============================================================
// MINIJUEGOS — el ordenador de la sala principal (idea 2).
//
// El Salón tiene siempre un escritorio con ordenador FIJO
// (no se puede vender, guardar ni mover). Al hacer click en él
// el avatar se acerca y se abre este modal con 5 minijuegos
// que dan créditos. Cada juego tiene un enfriamiento de 90 s
// (que empieza al INICIAR la partida, para evitar reintentos)
// y guarda tu mejor puntuación en Juego (listo para el
// guardado de la siguiente fase).
// ============================================================
var Minijuegos = (function () {

  var COOLDOWN_MS = 90 * 1000;

  var elFondo = null, elContenido = null;
  var temporizadores = [];
  var pantalla = "menu";

  var JUEGOS = [
    { id: "sumas", icono: "🧮", nombre: "Examen de sumas",
      desc: "10 sumas de cabeza. 1 crédito por acierto.", inicia: juegoSumas },
    { id: "memoria", icono: "🃏", nombre: "Juego de memoria",
      desc: "Encuentra las 8 parejas de furnis. Hasta 16 créditos.", inicia: juegoMemoria },
    { id: "preguntas", icono: "❓", nombre: "Preguntas rápidas",
      desc: "5 preguntas, 10 segundos cada una. 3 créditos por acierto.", inicia: juegoPreguntas },
    { id: "reflejos", icono: "⚡", nombre: "Reflejos",
      desc: "Pulsa la casilla iluminada, cada vez más rápido. 1 crédito por acierto.", inicia: juegoReflejos },
    { id: "adivina", icono: "🎲", nombre: "Adivina el número",
      desc: "Del 1 al 100 en 7 intentos. Cuanto antes, más premio (hasta 21).", inicia: juegoAdivina }
  ];

  function rand(n) { return Math.floor(Math.random() * n); }

  function barajar(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(i + 1), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // ---------------- temporizadores con limpieza ----------------

  function tempo(fn, ms) {
    var t = setTimeout(fn, ms);
    temporizadores.push(t);
    return t;
  }

  function cadaTanto(fn, ms) {
    var t = setInterval(fn, ms);
    temporizadores.push(t);
    return t;
  }

  function limpiar() {
    temporizadores.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    temporizadores = [];
  }

  // ---------------- apertura / cierre ----------------

  function iniciar() {
    elFondo = document.createElement("div");
    elFondo.id = "modal-fondo";
    elFondo.className = "oculto";
    elFondo.innerHTML =
      '<div id="modal-ordenador">' +
        '<div class="mo-barra"><span>💻 HabbOS · El ordenador de casa</span>' +
        '<button id="mo-cerrar">✕</button></div>' +
        '<div id="mo-contenido"></div>' +
      '</div>';
    document.getElementById("zona-canvas").appendChild(elFondo);
    elContenido = document.getElementById("mo-contenido");
    document.getElementById("mo-cerrar").addEventListener("click", cerrar);
    elFondo.addEventListener("click", function (e) {
      if (e.target === elFondo) cerrar();
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !elFondo.classList.contains("oculto")) cerrar();
    });
  }

  function abrir() {
    elFondo.classList.remove("oculto");
    menu();
  }

  function cerrar() {
    limpiar();
    elFondo.classList.add("oculto");
  }

  function enfriamiento(id) {
    var d = Juego.datosMinijuego(id);
    return Math.max(0, COOLDOWN_MS - (Date.now() - d.ultimo));
  }

  // ---------------- menú ----------------

  function menu() {
    limpiar();
    pantalla = "menu";
    elContenido.innerHTML = '<p class="mo-intro">Gana créditos jugando. Cada juego descansa 90 segundos entre partidas.</p>';
    JUEGOS.forEach(function (j) {
      var d = Juego.datosMinijuego(j.id);
      var fila = document.createElement("div");
      fila.className = "mo-juego-fila";
      fila.innerHTML =
        '<span class="mo-icono">' + j.icono + '</span>' +
        '<div class="mo-info"><div class="nombre">' + j.nombre + '</div>' +
        '<div class="detalle">' + j.desc +
        (d.mejor ? ' · Mejor: <b>' + d.mejor + '</b>' : '') + '</div></div>';
      var b = document.createElement("button");
      b.className = "mini dorado";
      var enfr = enfriamiento(j.id);
      if (enfr > 0) {
        b.disabled = true;
        b.classList.remove("dorado");
        b.textContent = "⏳ " + Math.ceil(enfr / 1000) + "s";
      } else {
        b.textContent = "Jugar";
        b.addEventListener("click", function () { empezarJuego(j.id); });
      }
      fila.appendChild(b);
      elContenido.appendChild(fila);
    });
    // refrescar los contadores de enfriamiento
    cadaTanto(function () {
      if (pantalla === "menu" && !elFondo.classList.contains("oculto")) menu();
    }, 1000);
  }

  function empezarJuego(id) {
    limpiar();
    pantalla = id;
    Juego.empezarMinijuego(id); // el enfriamiento arranca al empezar
    for (var i = 0; i < JUEGOS.length; i++) {
      if (JUEGOS[i].id === id) { JUEGOS[i].inicia(); return; }
    }
  }

  function cabeceraJuego(titulo, extra) {
    return '<div class="mo-cabecera-juego"><b>' + titulo + '</b>' +
      '<span class="detalle">' + (extra || "") + '</span>' +
      '<button class="mini" id="mo-salir">← Salir</button></div>';
  }

  function engancharSalir() {
    document.getElementById("mo-salir").addEventListener("click", function () {
      limpiar();
      menu();
    });
  }

  function resultado(id, puntos, premio, detalle) {
    limpiar();
    Juego.terminarMinijuego(id, puntos, premio);
    elContenido.innerHTML =
      '<div class="mo-resultado">' +
        '<div class="mo-pregunta">' + (premio > 0 ? "¡Bien jugado!" : "Otra vez será…") + '</div>' +
        '<div class="detalle">' + detalle + '</div>' +
        '<div class="mo-premio">🪙 +' + premio + ' créditos</div>' +
        '<button class="mini dorado" id="mo-volver">Volver al menú</button>' +
      '</div>';
    document.getElementById("mo-volver").addEventListener("click", menu);
  }

  // ==========================================================
  // 1) EXAMEN DE SUMAS — 10 preguntas, 1 cr por acierto
  // ==========================================================
  function juegoSumas() {
    var pregunta = 0, aciertos = 0;

    function pinta(feedback) {
      if (pregunta >= 10) {
        resultado("sumas", aciertos, aciertos, "Has acertado " + aciertos + " de 10 sumas.");
        return;
      }
      var a = 2 + rand(48), b = 2 + rand(48);
      elContenido.innerHTML =
        cabeceraJuego("🧮 Examen de sumas", "Pregunta " + (pregunta + 1) + "/10 · Aciertos: " + aciertos) +
        '<div class="mo-pregunta">' + a + " + " + b + " = ?</div>" +
        '<div class="mo-centrado"><input id="mo-input" type="number" autocomplete="off">' +
        ' <button class="mini dorado" id="mo-responder">Responder</button></div>' +
        '<div class="mo-estado">' + (feedback || "Escribe el resultado y pulsa Enter") + '</div>';
      engancharSalir();
      var input = document.getElementById("mo-input");
      input.focus();

      function responder() {
        var v = parseInt(input.value, 10);
        var ok = (v === a + b);
        if (ok) aciertos++;
        pregunta++;
        pinta(ok ? "✔ ¡Bien!" : "✘ Era " + (a + b));
      }
      document.getElementById("mo-responder").addEventListener("click", responder);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") responder();
      });
    }
    pinta();
  }

  // ==========================================================
  // 2) MEMORIA — 8 parejas de furnis, menos intentos = más premio
  // ==========================================================
  function juegoMemoria() {
    var ids = ["silla_roja", "planta_helecho", "tele", "cama_azul",
               "puf_amarillo", "lampara_pie", "sofa_rojo", "nevera"];
    var mazo = barajar(ids.concat(ids));
    var abierta = -1, bloqueo = false, parejas = 0, intentos = 0;

    elContenido.innerHTML =
      cabeceraJuego("🃏 Juego de memoria", '<span id="mo-marcador">Intentos: 0 · Parejas: 0/8</span>') +
      '<div class="mo-grid-memoria" id="mo-mazo"></div>';
    engancharSalir();

    var cont = document.getElementById("mo-mazo");
    var cartas = [];
    mazo.forEach(function (id, i) {
      var carta = document.createElement("div");
      carta.className = "mo-carta";
      var cv = document.createElement("canvas");
      cv.width = 64;
      cv.height = 54;
      carta.appendChild(cv);
      var tapa = document.createElement("span");
      tapa.className = "tapa";
      tapa.textContent = "❓";
      carta.appendChild(tapa);
      cont.appendChild(carta);
      Furnis.miniatura(cv, id);
      carta.addEventListener("click", function () { voltear(i); });
      cartas.push(carta);
    });

    function marcador() {
      document.getElementById("mo-marcador").textContent =
        "Intentos: " + intentos + " · Parejas: " + parejas + "/8";
    }

    function voltear(i) {
      if (bloqueo || i === abierta) return;
      if (cartas[i].classList.contains("emparejada") || cartas[i].classList.contains("abierta")) return;
      cartas[i].classList.add("abierta");
      if (abierta < 0) { abierta = i; return; }
      intentos++;
      var a = abierta;
      abierta = -1;
      if (mazo[a] === mazo[i]) {
        cartas[a].classList.add("emparejada");
        cartas[i].classList.add("emparejada");
        parejas++;
        marcador();
        if (parejas === 8) {
          var premio = Math.max(4, 24 - intentos);
          tempo(function () {
            resultado("memoria", premio, premio, "8 parejas en " + intentos + " intentos.");
          }, 700);
        }
      } else {
        bloqueo = true;
        marcador();
        tempo(function () {
          cartas[a].classList.remove("abierta");
          cartas[i].classList.remove("abierta");
          bloqueo = false;
        }, 750);
      }
    }
  }

  // ==========================================================
  // 3) PREGUNTAS RÁPIDAS — 5 preguntas, 10 s cada una, 3 cr/acierto
  // ==========================================================
  function generarPreguntas() {
    var comprables = Furnis.lista().filter(function (f) { return !f.recompensa && f.precio > 0; });
    var pool = [];
    // comparaciones de precio
    for (var i = 0; i < 3; i++) {
      var a = comprables[rand(comprables.length)], b = a;
      while (b.precio === a.precio) b = comprables[rand(comprables.length)];
      var caro = a.precio > b.precio ? a : b;
      pool.push({
        t: "¿Cuál es más caro: «" + a.nombre + "» o «" + b.nombre + "»?",
        ops: [a.nombre, b.nombre],
        c: (caro === a) ? 0 : 1
      });
    }
    // precio exacto
    var f2 = comprables[rand(comprables.length)];
    var ops2 = [f2.precio, f2.precio + 15 + rand(50), Math.max(5, f2.precio - 15 - rand(30))];
    var correcta = ops2[0];
    barajar(ops2);
    pool.push({
      t: "¿Cuánto cuesta «" + f2.nombre + "» en el catálogo?",
      ops: ops2.map(function (p) { return p + " cr"; }),
      c: ops2.indexOf(correcta)
    });
    // fijas del juego
    pool.push({ t: "¿Dónde viven los peces del jardín?", ops: ["En el acuario", "En el estanque", "En la bañera"], c: 0 });
    pool.push({ t: "¿Qué mascotas pasean libres por el jardín?", ops: ["Perros y gatos", "Peces y pájaros", "Los gnomos"], c: 0 });
    pool.push({ t: "¿Cuántos colores tiene la paleta del juego?", ops: ["20", "12", "32"], c: 0 });
    return barajar(pool).slice(0, 5);
  }

  function juegoPreguntas() {
    var preguntas = generarPreguntas();
    var indice = 0, aciertos = 0;
    var TIEMPO = 10000;

    function pinta() {
      limpiar();
      if (indice >= preguntas.length) {
        resultado("preguntas", aciertos, aciertos * 3,
          "Has acertado " + aciertos + " de " + preguntas.length + " preguntas.");
        return;
      }
      var p = preguntas[indice];
      elContenido.innerHTML =
        cabeceraJuego("❓ Preguntas rápidas", "Pregunta " + (indice + 1) + "/5 · Aciertos: " + aciertos) +
        '<div class="mo-pregunta chica">' + p.t + '</div>' +
        '<div class="mo-barra-tiempo"><div id="mo-tiempo" style="width:100%"></div></div>' +
        '<div id="mo-opciones"></div>';
      engancharSalir();

      var contOps = document.getElementById("mo-opciones");
      var resuelto = false;
      p.ops.forEach(function (op, i) {
        var b = document.createElement("button");
        b.className = "mo-opcion";
        b.textContent = op;
        b.addEventListener("click", function () {
          if (resuelto) return;
          resuelto = true;
          limpiar();
          var ok = (i === p.c);
          if (ok) aciertos++;
          b.classList.add(ok ? "bien" : "mal");
          if (!ok) contOps.children[p.c].classList.add("bien");
          indice++;
          tempo(pinta, 750);
        });
        contOps.appendChild(b);
      });

      // cuenta atrás
      var inicio = Date.now();
      cadaTanto(function () {
        var resta = Math.max(0, TIEMPO - (Date.now() - inicio));
        var barra = document.getElementById("mo-tiempo");
        if (barra) barra.style.width = (resta / TIEMPO * 100) + "%";
        if (resta <= 0 && !resuelto) {
          resuelto = true;
          limpiar();
          contOps.children[p.c].classList.add("bien");
          indice++;
          tempo(pinta, 750);
        }
      }, 100);
    }
    pinta();
  }

  // ==========================================================
  // 4) REFLEJOS — 12 rondas, la casilla se ilumina menos tiempo
  // ==========================================================
  function juegoReflejos() {
    var TOTAL = 12;
    var ronda = 0, aciertos = 0, limite = 1100, activa = -1;

    elContenido.innerHTML =
      cabeceraJuego("⚡ Reflejos", '<span id="mo-marcador">Ronda 0/' + TOTAL + " · Aciertos: 0</span>") +
      '<div class="mo-grid-reflejos" id="mo-celdas"></div>' +
      '<div class="mo-estado" id="mo-aviso">Pulsa la casilla que se ilumine</div>';
    engancharSalir();

    var cont = document.getElementById("mo-celdas");
    var celdas = [];
    for (var i = 0; i < 9; i++) {
      (function (idx) {
        var c = document.createElement("div");
        c.className = "mo-celda";
        c.addEventListener("click", function () { pulsar(idx); });
        cont.appendChild(c);
        celdas.push(c);
      })(i);
    }

    function marcador() {
      document.getElementById("mo-marcador").textContent =
        "Ronda " + ronda + "/" + TOTAL + " · Aciertos: " + aciertos;
    }

    function apagar() {
      if (activa >= 0) celdas[activa].classList.remove("activa");
      activa = -1;
    }

    function siguiente() {
      limpiar();
      apagar();
      ronda++;
      marcador();
      if (ronda > TOTAL) {
        resultado("reflejos", aciertos, aciertos, "Has cazado " + aciertos + " de " + TOTAL + " luces.");
        return;
      }
      tempo(function () {
        activa = rand(9);
        celdas[activa].classList.add("activa");
        tempo(function () { // demasiado lento
          if (activa >= 0) {
            document.getElementById("mo-aviso").textContent = "¡Demasiado lento!";
            siguiente();
          }
        }, limite);
      }, 400 + rand(600));
    }

    function pulsar(idx) {
      if (activa < 0) return;
      if (idx === activa) {
        aciertos++;
        limite = Math.max(550, limite - 45);
        document.getElementById("mo-aviso").textContent = "✔ ¡Bien!";
      } else {
        document.getElementById("mo-aviso").textContent = "✘ Esa no era";
      }
      siguiente();
    }

    ronda = 0;
    siguiente();
  }

  // ==========================================================
  // 5) ADIVINA EL NÚMERO — 1..100 en 7 intentos
  // ==========================================================
  function juegoAdivina() {
    var secreto = 1 + rand(100);
    var restantes = 7;
    var historial = [];

    function pinta(mensaje) {
      elContenido.innerHTML =
        cabeceraJuego("🎲 Adivina el número", "Intentos restantes: " + restantes) +
        '<div class="mo-pregunta chica">Estoy pensando un número del 1 al 100…</div>' +
        '<div class="mo-centrado"><input id="mo-input" type="number" min="1" max="100" autocomplete="off">' +
        ' <button class="mini dorado" id="mo-probar">Probar</button></div>' +
        '<div class="mo-estado">' + (mensaje || "¿Cuál será?") + '</div>' +
        '<div class="mo-historial">' + historial.join(" · ") + '</div>';
      engancharSalir();
      var input = document.getElementById("mo-input");
      input.focus();

      function probar() {
        var v = parseInt(input.value, 10);
        if (isNaN(v) || v < 1 || v > 100) { pinta("Escribe un número del 1 al 100"); return; }
        if (v === secreto) {
          var premio = restantes * 3;
          resultado("adivina", premio, premio,
            "¡Era el " + secreto + "! Te quedaban " + restantes + " intentos.");
          return;
        }
        restantes--;
        historial.push(v + (v < secreto ? "⬆" : "⬇"));
        if (restantes <= 0) {
          resultado("adivina", 0, 0, "Se acabaron los intentos: era el " + secreto + ".");
          return;
        }
        pinta(v < secreto ? "El número es MAYOR que " + v : "El número es MENOR que " + v);
      }
      document.getElementById("mo-probar").addEventListener("click", probar);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") probar();
      });
    }
    pinta();
  }

  return {
    iniciar: iniciar,
    abrir: abrir,
    cerrar: cerrar,
    enfriamiento: enfriamiento,
    depurar: {
      jugar: empezarJuego
    }
  };
})();
