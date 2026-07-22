// pages/api/admin/price-lists/[id].js
// DELETE /api/admin/price-lists/:id -> apaga a lista (e os itens dela, em cascata)
import { requireAdmin } from "../../../../lib/adminSession";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  const { id } = req.query;

  if (req.method === "DELETE") {
    const { error } = await supabaseAdmin.from("price_lists").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}