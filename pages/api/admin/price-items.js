// pages/api/admin/price-items.js
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method === "POST") {
    const { client_id, product_id, preco } = req.body || {};
    if (!client_id || !product_id || preco === undefined || preco === "") {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const { error } = await supabaseAdmin.from("price_list_items").upsert(
      {
        client_id,
        product_id,
        preco: Number(preco),
      },
      { onConflict: "client_id,product_id" }
    );

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { client_id, product_id } = req.body || {};
    if (!client_id || !product_id) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const { error } = await supabaseAdmin
      .from("price_list_items")
      .delete()
      .eq("client_id", client_id)
      .eq("product_id", product_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}