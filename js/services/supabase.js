"use strict";

// ============================================================
// NUBE — único punto de acceso a Supabase de todo el proyecto.
//
// Ningún otro módulo debe llamar a `window.supabase` ni a
// `createClient` directamente: todo pasa por aquí.
//
// De momento (T2) esto SOLO prepara la infraestructura: lee la
// configuración de `window.SUPABASE_CONFIG` (config.js), crea el
// cliente y deja saber si Supabase está disponible. Todavía no
// hay login, ni guardado/carga, ni sincronización, ni Realtime.
//
// Diseño defensivo: si no hay config.js, faltan las claves o no
// se cargó la librería, el juego sigue funcionando igual y
// Supabase queda simplemente deshabilitado (sin lanzar errores).
//
// Estados posibles (Nube.estado().estado):
//   "sin_iniciar"    - aún no se llamó a inicializar()
//   "sin_configurar" - falta config.js o las claves
//   "sin_libreria"   - no se cargó js/vendor/supabase.js
//   "error"          - createClient falló
//   "listo"          - cliente creado y disponible
// ============================================================
var Nube = (function () {

  var cliente = null;
  var estado = "sin_iniciar";
  var motivo = "";

  function config() {
    return (typeof window !== "undefined" && window.SUPABASE_CONFIG) || null;
  }

  function clave(cfg) {
    // aceptamos ambos nombres por comodidad; el término oficial
    // actual de Supabase es "publishable key"
    return cfg.publishableKey || cfg.anonKey || "";
  }

  // Crea el cliente si se puede. Idempotente: si ya está listo,
  // no vuelve a crearlo. Nunca lanza; devuelve true/false.
  function inicializar() {
    if (estado === "listo") return true;

    var cfg = config();
    if (!cfg || !cfg.url || !clave(cfg)) {
      estado = "sin_configurar";
      motivo = "Falta config.js o las claves de Supabase; se juega solo en local.";
      return false;
    }

    if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
      estado = "sin_libreria";
      motivo = "No se cargó supabase-js (js/vendor/supabase.js).";
      return false;
    }

    try {
      cliente = window.supabase.createClient(cfg.url, clave(cfg), {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      estado = "listo";
      motivo = "";
      return true;
    } catch (e) {
      cliente = null;
      estado = "error";
      motivo = (e && e.message) || String(e);
      return false;
    }
  }

  function disponible() {
    return estado === "listo" && !!cliente;
  }

  function obtenerCliente() {
    return cliente;
  }

  function estadoActual() {
    return { estado: estado, motivo: motivo };
  }

  // ---------------- autenticación (T4) ----------------
  // Envoltura defensiva de supabase.auth. NO toca la base de
  // datos ni guarda/carga partidas: solo gestiona la sesión.
  // Todas las funciones son asíncronas y devuelven el formato
  // de Supabase { data, error }; si Supabase no está disponible,
  // devuelven un error controlado en vez de romper.

  function errorSinNube() {
    return { data: null, error: { message: "Supabase no está disponible; se juega en local." } };
  }

  // Registro con email + contraseña (confirmación de email
  // desactivada en desarrollo → deja sesión iniciada).
  function registrar(email, contrasena) {
    if (!disponible()) return Promise.resolve(errorSinNube());
    return cliente.auth.signUp({ email: email, password: contrasena });
  }

  // Inicio de sesión con email + contraseña.
  function entrar(email, contrasena) {
    if (!disponible()) return Promise.resolve(errorSinNube());
    return cliente.auth.signInWithPassword({ email: email, password: contrasena });
  }

  // Cierre de sesión.
  function salir() {
    if (!disponible()) return Promise.resolve({ error: null });
    return cliente.auth.signOut();
  }

  // Usuario actual (o null). Lee la sesión persistida localmente
  // por supabase-js; es asíncrono.
  function usuario() {
    if (!disponible()) return Promise.resolve(null);
    return cliente.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session) ? r.data.session.user : null;
    });
  }

  // Suscribe un callback a los cambios de sesión (login/logout y
  // la sesión inicial al cargar). cb recibe (sesion|null, evento).
  // Devuelve una función para desuscribirse (no-op si no hay nube).
  function alCambiarSesion(cb) {
    if (!disponible()) return function () {};
    var r = cliente.auth.onAuthStateChange(function (evento, sesion) {
      cb(sesion || null, evento);
    });
    return function () {
      try { r.data.subscription.unsubscribe(); } catch (e) {}
    };
  }

  return {
    inicializar: inicializar,
    disponible: disponible,
    cliente: obtenerCliente,
    estado: estadoActual,
    registrar: registrar,
    entrar: entrar,
    salir: salir,
    usuario: usuario,
    alCambiarSesion: alCambiarSesion
  };
})();
