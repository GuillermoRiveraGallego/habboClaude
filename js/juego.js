"use strict";

// ============================================================
// JUEGO — estado global del jugador: créditos, inventario,
// salas y operaciones de economía. La UI orquesta; aquí vive
// el estado y sus reglas. (El guardado llega en la fase 4:
// `alCambiar` es el gancho de autoguardado.). .
// ============================================================
var Juego = (function () {

  var estado = null;
  var oyentes = [];

  function nuevaPartida() {
    return {
      version: 1,
      creditos: 1100000,
      sigUid: 100,
      inventario: [],
      salaActual: 0,
      salas: [
        {
          nombre: "El Salón", ancho: 10, fondo: 10,
          colorSuelo: "beige", colorPared: "azul_claro",
          desbloqueada: true, precio: 0,
          furnis: [
            { uid: 1, id: "cama_azul", x: 1, y: 7, rot: 0 },
            { uid: 2, id: "silla_roja", x: 6, y: 3, rot: 1 },
            { uid: 3, id: "planta_helecho", x: 0, y: 0, rot: 0 },
            { uid: 4, id: "cuadro_paisaje", pared: "x", slot: 3 },
            // el ordenador de casa: viene con la sala y no se
            // puede vender, guardar, mover ni rotar
            { uid: 5, id: "escritorio_ordenador", x: 6, y: 0, rot: 0, fijo: true }
          ]
        },
        {
          nombre: "El Estudio", ancho: 8, fondo: 8,
          colorSuelo: "gris", colorPared: "crema",
          desbloqueada: false, precio: 400,
          furnis: []
        },
        {
          nombre: "El Ático", ancho: 12, fondo: 9,
          colorSuelo: "madera", colorPared: "morado",
          desbloqueada: false, precio: 1200,
          furnis: []
        },
        {
          nombre: "El Jardín", ancho: 10, fondo: 10, tipo: "jardin",
          colorSuelo: "verde", colorPared: "verde_oscuro",
          desbloqueada: false, precio: 500,
          furnis: []
        },
        {
          nombre: "La Sala de Baile", ancho: 10, fondo: 8, tipo: "baile",
          colorSuelo: "gris", colorPared: "morado",
          desbloqueada: false, precio: 2000,
          furnis: [
            { uid: 6, id: "equipo_dj", x: 4, y: 0, rot: 0 },
            { uid: 7, id: "altavoz", x: 1, y: 0, rot: 1 },
            { uid: 8, id: "altavoz", x: 8, y: 0, rot: 1 },
            { uid: 9, id: "letrero_neon", pared: "x", slot: 2 },
            { uid: 10, id: "letrero_neon", pared: "y", slot: 4 },
            { uid: 11, id: "barra_bar", x: 8, y: 6, rot: 1 },
            { uid: 12, id: "taburete_disco", x: 7, y: 6, rot: 0 },
            { uid: 13, id: "taburete_disco", x: 7, y: 7, rot: 0 },
            { uid: 14, id: "sofa_vip", x: 1, y: 7, rot: 3 },
            { uid: 15, id: "foco_disco", x: 0, y: 2, rot: 0 },
            { uid: 16, id: "foco_disco", x: 9, y: 5, rot: 2 }
          ]
        },
        {
          nombre: "El Casino", ancho: 12, fondo: 10, tipo: "casino",
          colorSuelo: "verde_oscuro", colorPared: "madera_oscura",
          desbloqueada: false, precio: 3000,
          furnis: [
            { uid: 20, id: "cartel_casino", pared: "x", slot: 5 },
            { uid: 21, id: "cartel_casino", pared: "y", slot: 3 },
            { uid: 22, id: "tragaperras", x: 9, y: 0, rot: 1 },
            { uid: 23, id: "tragaperras", x: 10, y: 0, rot: 1 },
            { uid: 24, id: "mesa_blackjack", x: 2, y: 2, rot: 1 },
            { uid: 25, id: "ruleta_casino", x: 7, y: 2, rot: 0 },
            { uid: 26, id: "mesa_dados", x: 4, y: 5, rot: 0 },
            { uid: 27, id: "mesa_trile", x: 8, y: 6, rot: 0 },
            { uid: 28, id: "barra_casino", x: 1, y: 8, rot: 3 },
            { uid: 29, id: "taburete_casino", x: 1, y: 7, rot: 1 },
            { uid: 30, id: "taburete_casino", x: 2, y: 7, rot: 1 },
            { uid: 31, id: "sofa_cuero", x: 11, y: 4, rot: 2 },
            { uid: 32, id: "alfombra_casino_roja", x: 5, y: 3, rot: 0 },
            { uid: 33, id: "lampara_casino", x: 0, y: 0, rot: 0 },
            { uid: 34, id: "lampara_casino", x: 11, y: 9, rot: 0 },
            { uid: 35, id: "planta_casino", x: 0, y: 9, rot: 0 },
            { uid: 36, id: "planta_casino", x: 11, y: 0, rot: 0 }
          ]
        }
      ],
      mascotas: [],
      comida: { perro: 0, gato: 0, pez: 0, pajaro: 0 },
      recompensas: { fuente: false, gnomo: false, bola_disco: false, bailar: false },
      tareas: { fecha: "", progreso: {}, reclamadas: {}, juegosHoy: [], npcsHoy: [] },
      minijuegos: {},
      casino: { jugadas: 0, apostado: 0, ganado: 0 },
      ambiente: "auto",
      avatar: {
        peinado: "clasico",
        pelo: "madera_oscura",
        piel: "piel",
        camiseta: "turquesa",
        pantalon: "gris_oscuro",
        zapatos: "negro"
      }
    };
  }

  function cambio() {
    for (var i = 0; i < oyentes.length; i++) oyentes[i]();
  }

  // Rellena lo que le falte a una partida guardada antigua para
  // que sea compatible con la versión actual del juego.
  function migrar(datos) {
    var base = nuevaPartida();
    Object.keys(base).forEach(function (k) {
      if (datos[k] === undefined) datos[k] = base[k];
    });
    ["comida", "recompensas", "avatar", "tareas", "casino"].forEach(function (k) {
      Object.keys(base[k]).forEach(function (k2) {
        if (datos[k][k2] === undefined) datos[k][k2] = base[k][k2];
      });
    });
    // el ordenador fijo del salón debe existir siempre
    var salon = datos.salas[0];
    if (salon && !salon.furnis.some(function (f) { return f.fijo; })) {
      salon.furnis.push(base.salas[0].furnis.filter(function (f) { return f.fijo; })[0]);
    }
    // el jardín debe existir
    if (!datos.salas.some(function (s) { return s.tipo === "jardin"; })) {
      datos.salas.push(base.salas[3]);
    }
    // la sala de baile debe existir (antes del casino, para que
    // los índices de sala de los NPC fijos no se muevan)
    if (!datos.salas.some(function (s) { return s.tipo === "baile"; })) {
      var iCasino = -1;
      datos.salas.forEach(function (s, i) { if (s.tipo === "casino") iCasino = i; });
      if (iCasino === -1) datos.salas.push(base.salas[4]);
      else datos.salas.splice(iCasino, 0, base.salas[4]);
    }
    // el casino debe existir
    if (!datos.salas.some(function (s) { return s.tipo === "casino"; })) {
      datos.salas.push(base.salas[5]);
    }
    // la mesa de póker (retirada) ahora es la mesa del trile
    function aTrile(f) { if (f.id === "mesa_poker") f.id = "mesa_trile"; }
    datos.salas.forEach(function (s) { s.furnis.forEach(aTrile); });
    datos.inventario.forEach(aTrile);
    // la sala actual debe ser válida y estar desbloqueada
    if (!datos.salas[datos.salaActual] || !datos.salas[datos.salaActual].desbloqueada) {
      datos.salaActual = 0;
    }
    return datos;
  }

  // Arranca con una partida guardada (migrándola) o una nueva
  function iniciar(datosGuardados) {
    estado = datosGuardados ? migrar(datosGuardados) : nuevaPartida();
  }

  // ---------------- consultas ----------------

  function creditos() { return estado.creditos; }
  function inventario() { return estado.inventario; }
  function salas() { return estado.salas; }
  function salaActual() { return estado.salas[estado.salaActual]; }
  function indiceSala() { return estado.salaActual; }

  // ---------------- economía ----------------

  function gastar(n) {
    if (estado.creditos < n) return false;
    estado.creditos -= n;
    cambio();
    return true;
  }

  function ganar(n) {
    estado.creditos += n;
    cambio();
  }

  // Compra un furni: devuelve la instancia nueva o null si no
  // hay créditos. (Aún sin colocar: la coloca la UI.)
  function comprar(id) {
    var def = Furnis.get(id);
    if (!def || !gastar(def.precio)) return null;
    if (window.Tareas) Tareas.evento("gasto", def.precio);
    return { uid: estado.sigUid++, id: id };
  }

  function precioVenta(id) {
    return Math.floor(Furnis.get(id).precio / 2);
  }

  // Vende una instancia (ya retirada de sala/inventario por la UI)
  function vender(id) {
    var n = precioVenta(id);
    ganar(n);
    return n;
  }

  // ---------------- inventario ----------------

  function aInventario(inst) {
    estado.inventario.push({ uid: inst.uid, id: inst.id });
    cambio();
  }

  function deInventario(uid) {
    for (var i = 0; i < estado.inventario.length; i++) {
      if (estado.inventario[i].uid === uid) {
        return estado.inventario.splice(i, 1)[0];
      }
    }
    return null;
  }

  // ---------------- salas ----------------

  function cambiarSala(i) {
    if (!estado.salas[i] || !estado.salas[i].desbloqueada) return false;
    estado.salaActual = i;
    if (window.Tareas) Tareas.evento("sala", estado.salas[i].tipo || "normal");
    cambio();
    return true;
  }

  function desbloquearSala(i) {
    var s = estado.salas[i];
    if (!s || s.desbloqueada) return false;
    if (!gastar(s.precio)) return false;
    s.desbloqueada = true;
    cambio();
    return true;
  }

  function cambiarColor(tipo, color) {
    var s = salaActual();
    if (tipo === "suelo") s.colorSuelo = color;
    else s.colorPared = color;
    cambio();
  }

  // ---------------- mascotas (jardín) ----------------

  function mascotas() { return estado.mascotas; }
  function comida() { return estado.comida; }
  function recompensas() { return estado.recompensas; }

  function nuevaMascota(tipo, nombre, hogarUid) {
    var m = {
      uid: estado.sigUid++,
      tipo: tipo,
      nombre: nombre,
      hambre: 80,
      felicidad: 70,
      energia: 80,
      ultimaComida: Date.now(),
      ultimoJuego: 0,
      hogarUid: hogarUid || null
    };
    estado.mascotas.push(m);
    cambio();
    return m;
  }

  function agregarComida(tipo) {
    estado.comida[tipo] = (estado.comida[tipo] || 0) + 1;
    cambio();
  }

  function consumirComida(tipo) {
    if (!estado.comida[tipo]) return false;
    estado.comida[tipo]--;
    cambio();
    return true;
  }

  // Devuelve true solo la primera vez que se desbloquea
  function desbloquearRecompensa(id) {
    if (estado.recompensas[id]) return false;
    estado.recompensas[id] = true;
    cambio();
    return true;
  }

  // ---------------- aspecto del avatar ----------------

  function aspecto() { return estado.avatar; }

  function cambiarAspecto(clave, valor) {
    estado.avatar[clave] = valor;
    cambio();
  }

  // ---------------- ambiente (ciclo día/noche) ----------------

  function ambiente() { return estado.ambiente; }

  function cambiarAmbiente(valor) {
    estado.ambiente = valor;
    cambio();
  }

  // ---------------- minijuegos (ordenador de casa) ----------------

  function datosMinijuego(id) {
    if (!estado.minijuegos) estado.minijuegos = {};
    if (!estado.minijuegos[id]) estado.minijuegos[id] = { ultimo: 0, mejor: 0, veces: 0 };
    return estado.minijuegos[id];
  }

  // el enfriamiento arranca al empezar la partida (evita reintentos)
  function empezarMinijuego(id) {
    datosMinijuego(id).ultimo = Date.now();
    cambio();
  }

  function terminarMinijuego(id, puntos, premio) {
    var d = datosMinijuego(id);
    d.veces++;
    if (puntos > d.mejor) d.mejor = puntos;
    if (premio > 0) estado.creditos += premio;
    if (window.Tareas) Tareas.evento("minijuego", id);
    cambio();
    return premio;
  }

  // ---------------- casino ----------------

  function datosCasino() {
    if (!estado.casino) estado.casino = nuevaPartida().casino;
    return estado.casino;
  }

  // La apuesta se cobra por adelantado; false si no hay créditos
  function apostarCasino(n) {
    n = Math.floor(n);
    if (!(n > 0) || estado.creditos < n) return false;
    estado.creditos -= n;
    var d = datosCasino();
    d.jugadas++;
    d.apostado += n;
    cambio();
    return true;
  }

  // Abona el premio TOTAL de la jugada (0 si se pierde) y
  // dispara cambio() → autoguardado tras cada partida
  function premioCasino(n) {
    n = Math.floor(n);
    if (n > 0) {
      datosCasino().ganado += n;
      estado.creditos += n;
    }
    cambio();
  }

  // ---------------- tareas diarias ----------------

  function tareas() {
    if (!estado.tareas) estado.tareas = nuevaPartida().tareas;
    return estado.tareas;
  }

  return {
    iniciar: iniciar,
    creditos: creditos,
    inventario: inventario,
    salas: salas,
    salaActual: salaActual,
    indiceSala: indiceSala,
    ganar: ganar,
    gastar: gastar,
    comprar: comprar,
    vender: vender,
    precioVenta: precioVenta,
    aInventario: aInventario,
    deInventario: deInventario,
    cambiarSala: cambiarSala,
    desbloquearSala: desbloquearSala,
    cambiarColor: cambiarColor,
    mascotas: mascotas,
    comida: comida,
    recompensas: recompensas,
    nuevaMascota: nuevaMascota,
    agregarComida: agregarComida,
    consumirComida: consumirComida,
    desbloquearRecompensa: desbloquearRecompensa,
    aspecto: aspecto,
    cambiarAspecto: cambiarAspecto,
    ambiente: ambiente,
    cambiarAmbiente: cambiarAmbiente,
    datosMinijuego: datosMinijuego,
    empezarMinijuego: empezarMinijuego,
    terminarMinijuego: terminarMinijuego,
    datosCasino: datosCasino,
    apostarCasino: apostarCasino,
    premioCasino: premioCasino,
    tareas: tareas,
    ponAlCambiar: function (fn) { oyentes.push(fn); },
    estado: function () { return estado; }
  };
})();
