# js/vendor

Dependencias de terceros vendorizadas (copiadas al repo, no vía CDN ni npm),
para respetar la convención del proyecto de "scripts clásicos cargados en orden"
y que GitHub Pages funcione sin depender de un CDN externo.

## supabase.js

- Paquete: `@supabase/supabase-js`
- Versión: **2.110.0**
- Build: UMD standalone (expone el global `window.supabase` con `createClient`).
- Origen: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/dist/umd/supabase.js`

Para actualizarlo, volver a descargar ese mismo build y sustituir el archivo.
No editar a mano (es código minificado de terceros).
