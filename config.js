"use strict";

// ============================================================
// CONFIG — configuración de Supabase.
//
// La "Publishable Key" (publishable / anon) es PÚBLICA por
// diseño: va en el frontend y la protege RLS. No es un secreto,
// por eso este archivo SÍ se versiona (para que Supabase funcione
// también en el despliegue). Nunca pongas aquí la service_role key.
//
// La plantilla vive en config.example.js.
// ============================================================
window.SUPABASE_CONFIG = {
  url: "https://cwexlsdchowonmffqsda.supabase.co",
  publishableKey: "sb_publishable_cXOnD8FdamJBOqETTQabuQ__hgQJgoD",
};
