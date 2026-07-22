// pages/api/admin/clients.js
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method === "POST") {
    const { nome } = req.body || {};
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({ nome: nome.trim() })
      .select("id, nome, slug")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ client: data });
  }

  return res.status(405).end();
}