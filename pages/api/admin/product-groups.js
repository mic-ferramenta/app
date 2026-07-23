// pages/api/admin/product-groups.js
// GET /api/admin/product-groups?search=texto
// Lê da view produtos_catalogo -- já vem com o produto e o array de
// tamanhos/estoque prontos, sem precisar de embed aninhado.
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method !== "GET") return res.status(405).end();

  const search = String(req.query.search || "").trim();

  let query = supabaseAdmin
    .from("produtos_catalogo")
    .select("id, nome, codigo, imagem_url, preco_venda, preco_custo, variacoes")
    .eq("em_estoque", true) // esconde produtos sem estoque em nenhum tamanho
    .order("nome", { ascending: true })
    .limit(200);

  if (search) {
    query = query.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ groups: data || [] });
}