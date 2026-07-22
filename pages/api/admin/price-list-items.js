// pages/api/admin/price-list-items.js
// POST   -> adiciona ou atualiza o preço de um item dentro de uma lista já existente
// DELETE -> remove um item de uma lista já existente
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method === "POST") {
    const { price_list_id, group_id, preco } = req.body || {};
    if (!price_list_id || !group_id || preco === undefined || preco === "") {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const { error } = await supabaseAdmin.from("price_list_items").upsert(
      { price_list_id, group_id, preco: Number(preco) },
      { onConflict: "price_list_id,group_id" }
    );

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { price_list_id, group_id } = req.body || {};
    if (!price_list_id || !group_id) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const { error } = await supabaseAdmin
      .from("price_list_items")
      .delete()
      .eq("price_list_id", price_list_id)
      .eq("group_id", group_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}