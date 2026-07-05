"use strict";

// ============================================================
// CASINO — los juegos de apuestas de la sala casino. Se juega
// SOLO con los créditos del juego: nada de dinero real.
//
// Sistema común a todos los juegos: modal con estética de
// casino, selector de apuesta compartido (se recuerda entre
// juegos), validación de créditos, resultado claro (ganas /
// pierdes / empatas) y actualización de créditos vía Juego
// (apostarCasino cobra la apuesta por adelantado; premioCasino
// abona el premio TOTAL = apuesta × multiplicador y dispara
// cambio() → autoguardado tras cada partida).
//
// La lógica de cada juego vive en funciones puras (resolver*,
// valorMano, generarTrile) con azar real de Math.random() —
// sin amañar: se puede perder muchas veces seguidas. El trile
// ("Sigue la bolita") es el único con componente de habilidad:
// los intercambios se deciden al azar pero la mezcla se ve de
// verdad en pantalla, así que si no la pierdes de vista, ganas.
// ============================================================
var Casino = (function () {

  var elFondo = null, elContenido = null, elTitulo = null, elPie = null;
  var temporizadores = [];
  var apuesta = 25; // se recuerda entre juegos (efímera)

  var JUEGOS = {
    dados: { icono: "🎲", nombre: "Mesa de dados", inicia: juegoDados },
    ruleta: { icono: "🛞", nombre: "Ruleta europea", inicia: juegoRuleta },
    tragaperras: { icono: "🎰", nombre: "Tragaperras", inicia: juegoTragaperras },
    blackjack: { icono: "🃏", nombre: "Blackjack", inicia: juegoBlackjack },
    trile: { icono: "🥤", nombre: "Sigue la bolita", inicia: juegoTrile }
  };

  function rand(n) { return Math.floor(Math.random() * n); }

  // ----------------------------------------------------------
  // Lógica pura (probada en casino_flujo). Los multiplicadores
  // son sobre el premio TOTAL: x2 devuelve el doble de lo
  // apostado, 0 pierde la apuesta, 1 la recupera (empate).
  // ----------------------------------------------------------

  // --- dados: 2 dados, menor que 7 (x2), justo 7 (x5), mayor que 7 (x2)
  function resolverDados(d1, d2, tipo) {
    var suma = d1 + d2;
    if (tipo === "menor") return suma < 7 ? 2 : 0;
    if (tipo === "mayor") return suma > 7 ? 2 : 0;
    return suma === 7 ? 5 : 0; // "siete"
  }

  // --- ruleta europea: 0–36; el 0 hace perder las apuestas simples
  var ROJOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function colorRuleta(n) {
    if (n === 0) return "verde";
    return ROJOS.indexOf(n) !== -1 ? "rojo" : "negro";
  }

  function resolverRuleta(n, tipo, numero) {
    if (tipo === "numero") return n === numero ? 35 : 0;
    if (n === 0) return 0;
    if (tipo === "rojo") return colorRuleta(n) === "rojo" ? 2 : 0;
    if (tipo === "negro") return colorRuleta(n) === "negro" ? 2 : 0;
    if (tipo === "par") return n % 2 === 0 ? 2 : 0;
    return n % 2 === 1 ? 2 : 0; // "impar"
  }

  // --- tragaperras: 3 rodillos con 5 símbolos
  var SIMBOLOS = ["🍒", "🍋", "🔔", "7️⃣", "💎"];
  var PAGO_TRIPLE = { "🍒": 3, "🍋": 4, "🔔": 6, "7️⃣": 10, "💎": 20 };

  function resolverTragaperras(r) {
    if (r[0] === r[1] && r[1] === r[2]) return PAGO_TRIPLE[r[0]];
    if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) return 1.5;
    return 0;
  }

  // --- blackjack: valor de una mano (los ases valen 11 o 1)
  function valorMano(mano) {
    var total = 0, ases = 0;
    for (var i = 0; i < mano.length; i++) {
      total += mano[i].v;
      if (mano[i].v === 11) ases++;
    }
    while (total > 21 && ases > 0) { total -= 10; ases--; }
    return total;
  }

  function crearBaraja() {
    var palos = ["♠", "♥", "♦", "♣"];
    var cartas = [];
    for (var p = 0; p < 4; p++) {
      for (var n = 2; n <= 10; n++) cartas.push({ txt: n + palos[p], v: n, palo: palos[p] });
      ["J", "Q", "K"].forEach(function (f) {
        cartas.push({ txt: f + palos[p], v: 10, palo: palos[p] });
      });
      cartas.push({ txt: "A" + palos[p], v: 11, palo: palos[p] });
    }
    for (var i = cartas.length - 1; i > 0; i--) {
      var j = rand(i + 1), t = cartas[i];
      cartas[i] = cartas[j];
      cartas[j] = t;
    }
    return cartas;
  }

  // --- trile ("Sigue la bolita"): 3 vasos, la bola bajo uno,
  // se mezclan a la vista y hay que señalar dónde quedó. Tres
  // velocidades: más rápida, más paga. generarTrile decide los
  // intercambios al azar y sigue la bola (puro, testeable).
  var TRILE_NIVELES = {
    tranquilo: { id: "tranquilo", nombre: "Tranquilo", cambios: 12, ms: 520, mult: 1.5 },
    normal: { id: "normal", nombre: "Normal", cambios: 18, ms: 350, mult: 2 },
    vertiginoso: { id: "vertiginoso", nombre: "Vertiginoso", cambios: 26, ms: 215, mult: 3 }
  };

  function generarTrile(posInicial, numCambios) {
    var pos = posInicial;
    var cambios = [];
    for (var i = 0; i < numCambios; i++) {
      var a = rand(3);
      var b = (a + 1 + rand(2)) % 3; // siempre dos vasos distintos
      cambios.push([a, b]);
      if (pos === a) pos = b;
      else if (pos === b) pos = a;
    }
    return { cambios: cambios, posFinal: pos };
  }

  // ----------------------------------------------------------
  // Temporizadores con limpieza (mismo patrón que Minijuegos)
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Apertura / cierre del modal
  // ----------------------------------------------------------

  function iniciar() {
    elFondo = document.createElement("div");
    elFondo.id = "modal-fondo-casino";
    elFondo.className = "oculto";
    elFondo.innerHTML =
      '<div id="modal-casino">' +
        '<div class="ca-barra"><span id="ca-titulo">🎰 Casino</span>' +
        '<button id="ca-cerrar">✕</button></div>' +
        '<div id="ca-contenido"></div>' +
        '<div class="ca-pie">💰 <span id="ca-creditos">0</span> créditos · ' +
        '<span id="ca-stats"></span></div>' +
      '</div>';
    document.getElementById("zona-canvas").appendChild(elFondo);
    elContenido = document.getElementById("ca-contenido");
    elTitulo = document.getElementById("ca-titulo");
    elPie = document.getElementById("ca-stats");
    document.getElementById("ca-cerrar").addEventListener("click", cerrar);
    elFondo.addEventListener("click", function (e) {
      if (e.target === elFondo) cerrar();
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !elFondo.classList.contains("oculto")) cerrar();
    });
    Juego.ponAlCambiar(refrescarPie);
  }

  function refrescarPie() {
    if (!elFondo || elFondo.classList.contains("oculto")) return;
    document.getElementById("ca-creditos").textContent = Juego.creditos();
    var d = Juego.datosCasino();
    elPie.textContent = d.jugadas + " jugadas · apostado " + d.apostado +
      " · ganado " + d.ganado;
  }

  function abrir(juego) {
    var j = JUEGOS[juego];
    if (!j) return;
    elFondo.classList.remove("oculto");
    elTitulo.textContent = j.icono + " " + j.nombre;
    refrescarPie();
    limpiar();
    j.inicia();
  }

  function cerrar() {
    limpiar();
    elFondo.classList.add("oculto");
  }

  // ----------------------------------------------------------
  // Piezas comunes: apuesta, cobro y panel de resultado
  // ----------------------------------------------------------

  function filaApuesta() {
    var html = '<div class="ca-apuesta"><span>Apuesta:</span>' +
      '<input id="ca-apuesta" type="number" min="1" value="' + apuesta + '" autocomplete="off">';
    [5, 25, 100, 500].forEach(function (n) {
      html += '<button class="ca-ficha" data-ficha="' + n + '">' + n + '</button>';
    });
    return html + '</div>';
  }

  function engancharFichas() {
    elContenido.querySelectorAll("[data-ficha]").forEach(function (b) {
      b.addEventListener("click", function () {
        document.getElementById("ca-apuesta").value = b.getAttribute("data-ficha");
      });
    });
  }

  // Lee la apuesta del selector y la cobra por adelantado.
  // Devuelve la cantidad o 0 (sin créditos / apuesta inválida).
  function cobrarApuesta() {
    var input = document.getElementById("ca-apuesta");
    var n = Math.floor(parseInt(input.value, 10));
    if (isNaN(n) || n < 1) {
      ponEstado("La apuesta mínima es 1 crédito");
      return 0;
    }
    if (!Juego.apostarCasino(n)) {
      ponEstado("No tienes créditos suficientes");
      return 0;
    }
    apuesta = n;
    return n;
  }

  function ponEstado(texto) {
    var el = document.getElementById("ca-estado");
    if (el) el.textContent = texto;
  }

  // Abona el premio y pinta el resultado. mult: 0 pierde,
  // 1 empata (recupera la apuesta), >1 gana.
  function resultado(a, mult, detalle, otraVez) {
    var premio = Math.floor(a * mult);
    Juego.premioCasino(premio); // guarda la partida (cambio → autoguardado)
    var titulo, clase;
    if (mult === 1) { titulo = "🤝 Empate: recuperas tu apuesta"; clase = "empate"; }
    else if (premio > 0) { titulo = "🎉 ¡Has ganado " + premio + " créditos!"; clase = "gana"; }
    else { titulo = "💸 Has perdido " + a + " créditos"; clase = "pierde"; }
    var div = document.createElement("div");
    div.className = "ca-resultado " + clase;
    div.innerHTML = '<div class="ca-veredicto">' + titulo + '</div>' +
      '<div class="detalle">' + detalle + '</div>' +
      '<button class="mini dorado" id="ca-otra">🔁 Jugar otra vez</button> ' +
      '<button class="mini" id="ca-volver">Volver al casino</button>';
    elContenido.appendChild(div);
    document.getElementById("ca-otra").addEventListener("click", function () {
      limpiar();
      otraVez();
    });
    document.getElementById("ca-volver").addEventListener("click", cerrar);
  }

  // ==========================================================
  // 1) DADOS — menor que 7 (x2) · justo 7 (x5) · mayor que 7 (x2)
  // ==========================================================

  var CARAS_DADO = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  function juegoDados() {
    elContenido.innerHTML =
      filaApuesta() +
      '<div class="ca-dados"><span id="ca-dado1">🎲</span><span id="ca-dado2">🎲</span></div>' +
      '<div class="ca-opciones">' +
        '<button class="ca-opcion" data-tipo="menor">Menor que 7<br><b>x2</b></button>' +
        '<button class="ca-opcion" data-tipo="siete">Justo 7<br><b>x5</b></button>' +
        '<button class="ca-opcion" data-tipo="mayor">Mayor que 7<br><b>x2</b></button>' +
      '</div>' +
      '<div class="mo-estado" id="ca-estado">Elige apuesta y a qué juegas: se tiran 2 dados</div>';
    engancharFichas();

    elContenido.querySelectorAll("[data-tipo]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = cobrarApuesta();
        if (!a) return;
        var tipo = b.getAttribute("data-tipo");
        elContenido.querySelectorAll("[data-tipo]").forEach(function (o) { o.disabled = true; });
        var e1 = document.getElementById("ca-dado1");
        var e2 = document.getElementById("ca-dado2");
        ponEstado("Rodando…");
        cadaTanto(function () {
          e1.textContent = CARAS_DADO[rand(6)];
          e2.textContent = CARAS_DADO[rand(6)];
        }, 90);
        tempo(function () {
          limpiar();
          var d1 = 1 + rand(6), d2 = 1 + rand(6);
          e1.textContent = CARAS_DADO[d1 - 1];
          e2.textContent = CARAS_DADO[d2 - 1];
          var mult = resolverDados(d1, d2, tipo);
          var nombreTipo = tipo === "menor" ? "menor que 7" :
                           tipo === "mayor" ? "mayor que 7" : "justo 7";
          ponEstado("");
          resultado(a, mult,
            "Salió " + d1 + " + " + d2 + " = <b>" + (d1 + d2) + "</b> y apostaste a " + nombreTipo + ".",
            juegoDados);
        }, 1000);
      });
    });
  }

  // ==========================================================
  // 2) RULETA EUROPEA — 0–36 · rojo/negro/par/impar x2 · número x35
  // ==========================================================

  function juegoRuleta() {
    elContenido.innerHTML =
      filaApuesta() +
      '<div class="ca-ruleta"><span class="ca-num verde" id="ca-num">?</span></div>' +
      '<div class="ca-opciones">' +
        '<button class="ca-opcion" data-tipo="rojo">🔴 Rojo<br><b>x2</b></button>' +
        '<button class="ca-opcion" data-tipo="negro">⚫ Negro<br><b>x2</b></button>' +
        '<button class="ca-opcion" data-tipo="par">Par<br><b>x2</b></button>' +
        '<button class="ca-opcion" data-tipo="impar">Impar<br><b>x2</b></button>' +
      '</div>' +
      '<div class="ca-numero-linea">Al número ' +
        '<input id="ca-numero" type="number" min="0" max="36" value="17" autocomplete="off">' +
        '<button class="ca-opcion chica" data-tipo="numero">Jugar número <b>x35</b></button>' +
      '</div>' +
      '<div class="mo-estado" id="ca-estado">El 0 hace perder rojo, negro, par e impar</div>';
    engancharFichas();

    elContenido.querySelectorAll("[data-tipo]").forEach(function (b) {
      b.addEventListener("click", function () {
        var tipo = b.getAttribute("data-tipo");
        var numero = 0;
        if (tipo === "numero") {
          numero = Math.floor(parseInt(document.getElementById("ca-numero").value, 10));
          if (isNaN(numero) || numero < 0 || numero > 36) {
            ponEstado("El número debe estar entre 0 y 36");
            return;
          }
        }
        var a = cobrarApuesta();
        if (!a) return;
        elContenido.querySelectorAll("[data-tipo]").forEach(function (o) { o.disabled = true; });
        var elNum = document.getElementById("ca-num");
        ponEstado("La bola gira…");
        cadaTanto(function () {
          var falso = rand(37);
          elNum.textContent = falso;
          elNum.className = "ca-num " + colorRuleta(falso);
        }, 80);
        tempo(function () {
          limpiar();
          var n = rand(37); // 0..36, azar real
          elNum.textContent = n;
          elNum.className = "ca-num " + colorRuleta(n);
          var mult = resolverRuleta(n, tipo, numero);
          var nombreTipo = tipo === "numero" ? "al " + numero : "a " + tipo;
          ponEstado("");
          resultado(a, mult,
            "Salió el <b>" + n + "</b> (" + colorRuleta(n) + ") y apostaste " + nombreTipo + ".",
            juegoRuleta);
        }, 1400);
      });
    });
  }

  // ==========================================================
  // 3) TRAGAPERRAS — 3 rodillos · triples x3–x20 · pareja x1.5
  // Modo máquina: el resultado sale bajo los rodillos y el
  // botón Tirar se rearma solo, para encadenar tiradas.
  // ==========================================================

  function juegoTragaperras() {
    var tabla = SIMBOLOS.map(function (s) {
      return '<span>' + s + s + s + ' x' + PAGO_TRIPLE[s] + '</span>';
    }).join(" · ") + ' · <span>dos iguales x1.5</span>';
    elContenido.innerHTML =
      filaApuesta() +
      '<div class="ca-rodillos">' +
        '<span id="ca-rodillo0">❔</span><span id="ca-rodillo1">❔</span><span id="ca-rodillo2">❔</span>' +
      '</div>' +
      '<div class="ca-resultado-inline" id="ca-premio-traga">Cada tirada cuesta tu apuesta</div>' +
      '<div class="mo-centrado"><button class="ca-opcion" id="ca-tirar">🎰 Tirar</button></div>' +
      '<div class="ca-tabla-pagos">' + tabla + '</div>' +
      '<div class="mo-estado" id="ca-estado"></div>';
    engancharFichas();

    var btnTirar = document.getElementById("ca-tirar");
    var elPremio = document.getElementById("ca-premio-traga");
    var rodillos = [
      document.getElementById("ca-rodillo0"),
      document.getElementById("ca-rodillo1"),
      document.getElementById("ca-rodillo2")
    ];

    btnTirar.addEventListener("click", function () {
      var a = cobrarApuesta();
      if (!a) return;
      btnTirar.disabled = true;
      ponEstado("");
      elPremio.className = "ca-resultado-inline";
      elPremio.textContent = "Girando…";
      var final = [SIMBOLOS[rand(5)], SIMBOLOS[rand(5)], SIMBOLOS[rand(5)]];
      var parados = [false, false, false];
      rodillos.forEach(function (r) { r.classList.remove("parado"); });
      cadaTanto(function () {
        for (var i = 0; i < 3; i++) {
          if (!parados[i]) rodillos[i].textContent = SIMBOLOS[rand(5)];
        }
      }, 80);
      // los rodillos se paran escalonados
      [600, 1050, 1500].forEach(function (ms, i) {
        tempo(function () {
          parados[i] = true;
          rodillos[i].textContent = final[i];
          rodillos[i].classList.add("parado");
          if (i === 2) {
            limpiar();
            var mult = resolverTragaperras(final);
            var premio = Math.floor(a * mult);
            Juego.premioCasino(premio); // cambio() → autoguardado
            if (mult === 0) {
              elPremio.className = "ca-resultado-inline pierde";
              elPremio.textContent = "💸 Sin premio: pierdes " + a + " créditos";
            } else {
              elPremio.className = "ca-resultado-inline gana";
              elPremio.textContent = "🎉 " + (mult === 1.5 ? "¡Dos iguales!" : "¡TRIPLE!") +
                " Ganas " + premio + " créditos";
            }
            btnTirar.disabled = false;
          }
        }, ms);
      });
    });
  }

  // ==========================================================
  // 4) BLACKJACK — pedir/plantarse · banca hasta 17 ·
  //    blackjack natural x2.5 · victoria x2 · empate x1
  // ==========================================================

  function cartaHtml(c, oculta) {
    if (oculta) return '<span class="ca-carta dorso">🂠</span>';
    var roja = (c.palo === "♥" || c.palo === "♦");
    return '<span class="ca-carta' + (roja ? " roja" : "") + '">' + c.txt + '</span>';
  }

  function manoHtml(mano, ocultarSegunda) {
    return mano.map(function (c, i) {
      return cartaHtml(c, ocultarSegunda && i === 1);
    }).join("");
  }

  function juegoBlackjack() {
    elContenido.innerHTML =
      filaApuesta() +
      '<div class="ca-bj-mesa">' +
        '<p class="mo-intro">La banca roba hasta 17 o más. Blackjack natural paga x2.5, ' +
        'victoria x2, empate devuelve la apuesta.</p>' +
        '<div class="mo-centrado"><button class="ca-opcion" id="ca-repartir">🃏 Repartir</button></div>' +
      '</div>' +
      '<div class="mo-estado" id="ca-estado"></div>';
    engancharFichas();

    document.getElementById("ca-repartir").addEventListener("click", function () {
      var a = cobrarApuesta();
      if (!a) return;
      var baraja = crearBaraja();
      var manoJ = [baraja.pop(), baraja.pop()];
      var manoB = [baraja.pop(), baraja.pop()];
      var mesa = elContenido.querySelector(".ca-bj-mesa");

      function pintaManos(revelarBanca) {
        mesa.innerHTML =
          '<div class="ca-bj-fila"><span class="ca-bj-quien">Banca (' +
            (revelarBanca ? valorMano(manoB) : "?") + ')</span>' +
            manoHtml(manoB, !revelarBanca) + '</div>' +
          '<div class="ca-bj-fila"><span class="ca-bj-quien">Tú (' + valorMano(manoJ) + ')</span>' +
            manoHtml(manoJ, false) + '</div>' +
          (revelarBanca ? '' :
            '<div class="mo-centrado"><button class="ca-opcion chica" id="ca-pedir">🂡 Pedir carta</button> ' +
            '<button class="ca-opcion chica" id="ca-plantarse">✋ Plantarse</button></div>');
      }

      function terminar(mult, detalle) {
        pintaManos(true);
        resultado(a, mult, detalle + " Banca: " + valorMano(manoB) + " · Tú: " + valorMano(manoJ) + ".",
          juegoBlackjack);
      }

      function plantarse() {
        while (valorMano(manoB) < 17) manoB.push(baraja.pop());
        var vJ = valorMano(manoJ), vB = valorMano(manoB);
        if (vB > 21) terminar(2, "La banca se pasa de 21.");
        else if (vJ > vB) terminar(2, "Tu mano gana.");
        else if (vJ === vB) terminar(1, "Mismo valor: empate.");
        else terminar(0, "La banca gana.");
      }

      function jugar() {
        pintaManos(false);
        document.getElementById("ca-pedir").addEventListener("click", function () {
          manoJ.push(baraja.pop());
          var v = valorMano(manoJ);
          if (v > 21) terminar(0, "Te pasas de 21.");
          else if (v === 21) plantarse();
          else jugar();
        });
        document.getElementById("ca-plantarse").addEventListener("click", plantarse);
      }

      // blackjack natural con las 2 primeras cartas
      if (valorMano(manoJ) === 21) {
        if (valorMano(manoB) === 21) terminar(1, "Doble blackjack: empate.");
        else terminar(2.5, "¡Blackjack natural!");
      } else {
        jugar();
      }
    });
  }

  // ==========================================================
  // 5) SIGUE LA BOLITA (trile) — la bola se esconde bajo un
  //    vaso, los vasos se mezclan a la vista y señalas dónde
  //    quedó. Habilidad pura: síguela y ganas.
  // ==========================================================

  var TRILE_X = [12, 112, 212]; // px del vaso de cada hueco

  function juegoTrile() {
    var niveles = ["tranquilo", "normal", "vertiginoso"];
    elContenido.innerHTML =
      filaApuesta() +
      '<div class="ca-trile" id="ca-trile">' +
        '<div class="ca-bola" id="ca-bola"></div>' +
        '<div class="ca-vaso"></div><div class="ca-vaso"></div><div class="ca-vaso"></div>' +
      '</div>' +
      '<div class="ca-opciones">' + niveles.map(function (id) {
        var n = TRILE_NIVELES[id];
        return '<button class="ca-opcion" data-nivel="' + id + '">' + n.nombre +
          '<br><b>x' + n.mult + '</b></button>';
      }).join("") + '</div>' +
      '<div class="mo-estado" id="ca-estado">Elige velocidad: te enseño la bolita, mezclo los vasos y me dices dónde quedó</div>';
    engancharFichas();

    var vasos = Array.prototype.slice.call(elContenido.querySelectorAll(".ca-vaso"));
    var bola = document.getElementById("ca-bola");
    var vasoEn = [vasos[0], vasos[1], vasos[2]]; // qué vaso hay en cada hueco
    vasos.forEach(function (v, i) { v.style.left = TRILE_X[i] + "px"; });

    function ponBola(hueco) {
      bola.style.left = (TRILE_X[hueco] + 23) + "px";
    }

    elContenido.querySelectorAll("[data-nivel]").forEach(function (b) {
      b.addEventListener("click", function () {
        var nivel = TRILE_NIVELES[b.getAttribute("data-nivel")];
        var a = cobrarApuesta();
        if (!a) return;
        elContenido.querySelectorAll("[data-nivel]").forEach(function (o) { o.disabled = true; });

        var inicio = rand(3);
        var jugada = generarTrile(inicio, nivel.cambios);
        vasos.forEach(function (v) {
          v.style.transitionDuration = Math.round(nivel.ms * 0.85) + "ms, 250ms";
        });

        // 1) enseñar la bola bajo su vaso
        ponBola(inicio);
        bola.classList.add("visible");
        vasoEn[inicio].classList.add("arriba");
        ponEstado("Mira bien dónde está…");

        tempo(function () {
          // 2) tapar y mezclar
          vasoEn[inicio].classList.remove("arriba");
          bola.classList.remove("visible");
          ponEstado("¡Sigue la bolita!");
          var paso = 0;
          tempo(function mezcla() {
            if (paso >= jugada.cambios.length) { elegir(); return; }
            var c = jugada.cambios[paso++];
            var va = vasoEn[c[0]], vb = vasoEn[c[1]];
            va.style.left = TRILE_X[c[1]] + "px";
            vb.style.left = TRILE_X[c[0]] + "px";
            vasoEn[c[0]] = vb;
            vasoEn[c[1]] = va;
            tempo(mezcla, nivel.ms);
          }, 350);
        }, 1100);

        // 3) el jugador señala un vaso
        function elegir() {
          ponEstado("¿Dónde está la bolita? Toca un vaso");
          document.getElementById("ca-trile").classList.add("elegible");
          var elegido = false;
          vasos.forEach(function (v) {
            v.addEventListener("click", function () {
              if (elegido) return;
              elegido = true;
              document.getElementById("ca-trile").classList.remove("elegible");
              var hueco = vasoEn.indexOf(v);
              var acierta = (hueco === jugada.posFinal);
              // 4) revelar: primero el elegido y, si falla, el bueno
              ponBola(jugada.posFinal);
              if (acierta) bola.classList.add("visible");
              v.classList.add("arriba");
              tempo(function () {
                if (!acierta) {
                  bola.classList.add("visible");
                  vasoEn[jugada.posFinal].classList.add("arriba");
                }
                ponEstado("");
                resultado(a, acierta ? nivel.mult : 0,
                  acierta ? "¡Ojo de lince! No la perdiste de vista (nivel " + nivel.nombre.toLowerCase() + ")."
                          : "La bolita estaba en el otro vaso. ¡Casi!",
                  juegoTrile);
              }, acierta ? 500 : 700);
            });
          });
        }
      });
    });
  }

  return {
    iniciar: iniciar,
    abrir: abrir,
    cerrar: cerrar,
    // lógica pura para las pruebas (casino_flujo)
    resolverDados: resolverDados,
    resolverRuleta: resolverRuleta,
    resolverTragaperras: resolverTragaperras,
    colorRuleta: colorRuleta,
    valorMano: valorMano,
    generarTrile: generarTrile,
    TRILE_NIVELES: TRILE_NIVELES,
    crearBaraja: crearBaraja
  };
})();
