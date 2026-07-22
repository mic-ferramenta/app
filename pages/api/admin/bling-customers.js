// pages/api/admin/bling-customers.js
// GET /api/admin/bling-customers?search=texto
// Busca os clientes (contatos) do Bling já sincronizados no Supabase.
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method !== "GET") return res.status(405).end();

  const search = String(req.query.search || "").trim();

  let query = supabaseAdmin
    .from("bling_customers")
    .select("id, bling_id, nome, documento, email, telefone")
    .order("nome", { ascending: true })
    .limit(50);

  if (search) {
    query = query.or(`nome.ilike.%${search}%,documento.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ customers: data || [] });
}