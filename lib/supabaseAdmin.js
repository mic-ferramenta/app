// lib/supabaseAdmin.js
//
// Client do Supabase usando a service_role key.
// Só pode ser importado em código que roda no SERVIDOR
// (getServerSideProps, API routes) -- nunca em componentes de página que
// rodam no navegador, senão a chave vazaria pro cliente.

import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);