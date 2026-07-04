"use strict";

// ============================================================
// JUEGO — estado global del jugador: créditos, inventario,
// salas y operaciones de economía. La UI orquesta; aquí vive
// el estado y sus reglas. (El guardado llega en la fase 4:
// `alCambiar` es el gancho de autoguardado.)
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
        }
      ],
      mascotas: [],
      comida: { perro: 0, gato: 0, pez: 0, pajaro: 0 },
      recompensas: { fuente: false, gnomo: false },
      minijuegos: {},
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
    ["comida", "recompensas", "avatar"].forEach(function (k) {
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
    cambio();
    return premio;
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
    ponAlCambiar: function (fn) { oyentes.push(fn); },
    estado: function () { return estado; }
  };
})();
