// pages/api/admin/price-list-items.js
// POST   -> adiciona/atualiza um item de uma lista já existente. Aceita
//           preco e/ou ordem -- manda só o que quer mudar.
// DELETE -> remove um item de uma lista já existente
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method === "POST") {
    const { price_list_id, pai_id, preco, ordem } = req.body || {};
    if (!price_list_id || !pai_id) {
      return res.status(400).json({ error: "Dados incompletos." });
    }
    if (preco === undefined && ordem === undefined) {
      return res.status(400).json({ error: "Nada para atualizar (preco ou ordem)." });
    }

    const row = { price_list_id, pai_id };
    if (preco !== undefined && preco !== "") row.preco = Number(preco);
    if (ordem !== undefined) row.ordem = Number(ordem);

    const { error } = await supabaseAdmin
      .from("price_list_items")
      .upsert(row, { onConflict: "price_list_id,pai_id" });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { price_list_id, pai_id } = req.body || {};
    if (!price_list_id || !pai_id) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const { error } = await supabaseAdmin
      .from("price_list_items")
      .delete()
      .eq("price_list_id", price_list_id)
      .eq("pai_id", pai_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}