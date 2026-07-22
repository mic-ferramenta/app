// pages/api/admin/product-groups.js
// GET /api/admin/product-groups?search=texto
// Retorna os produtos já consolidados (1 linha por produto, com a
// lista de tamanhos/estoque dentro de "variacoes").
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method !== "GET") return res.status(405).end();

  const search = String(req.query.search || "").trim();

  let query = supabaseAdmin
    .from("product_groups")
    .select(
      "id, nome, codigo, imagem_url, preco_venda, preco_custo, variacoes:products(id, tamanho, estoque)"
    )
    .order("nome", { ascending: true })
    .limit(200);

  if (search) {
    query = query.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ groups: data || [] });
}