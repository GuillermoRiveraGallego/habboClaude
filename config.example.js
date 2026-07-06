"use strict";

// ============================================================
// CONFIG (plantilla) — configuración de Supabase.
//
// CÓMO USARLO:
//   1. Copia este archivo a `config.js` (en la misma carpeta).
//   2. Pega tus dos valores de Supabase abajo (Project Settings
//      → API en el panel de Supabase).
//   3. `config.js` está en .gitignore: no se sube a Git.
//
// Este archivo (config.example.js) SÍ se versiona y solo sirve
// de plantilla; nunca pongas aquí tus claves reales.
//
// NOTA de seguridad: la "Publishable Key" (publishable / anon)
// es PÚBLICA por diseño — va en el frontend y la protege RLS.
// No es un secreto; nunca uses aquí la service_role key.
// ============================================================
window.SUPABASE_CONFIG = {
  url: "https://cwexlsdchowonmffqsda.supabase.co",
  publishableKey: "sb_publishable_cXOnD8FdamJBOqETTQabuQ__hgQJgoD",
};
