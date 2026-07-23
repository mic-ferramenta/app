// pages/api/admin/product-groups.js
// GET /api/admin/product-groups?search=texto&modo=unidade|grade
// Lê da view produtos_catalogo. modo=grade filtra só produtos que
// batem com pelo menos 1 grade cadastrada, considerando o estoque
// ATUAL (recalculado a cada chamada, nunca fica desatualizado).
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { estoquePorTamanho, gradeQueCabe } from "../../../lib/grades";

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method !== "GET") return res.status(405).end();

  const search = String(req.query.search || "").trim();
  const modo = req.query.modo === "grade" ? "grade" : "unidade";

  let query = supabaseAdmin
    .from("produtos_catalogo")
    .select("id, nome, codigo, imagem_url, preco_venda, preco_custo, variacoes, em_estoque")
    .order("nome", { ascending: true })
    .limit(200);

  if (search) {
    query = query.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%`);
  }
  if (modo === "unidade") {
    query = query.eq("em_estoque", true); // esconde produtos sem estoque em nenhum tamanho
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  if (modo === "unidade") {
    return res.status(200).json({ groups: data || [] });
  }

  // modo grade: só entram produtos que HOJE batem com pelo menos 1 grade
  const { data: gradesData, error: gradesError } = await supabaseAdmin
    .from("grades")
    .select("id, nome, prioridade, composicao")
    .eq("ativo", true)
    .order("prioridade", { ascending: true });

  if (gradesError) return res.status(500).json({ error: gradesError.message });

  const groups = (data || [])
    .map((g) => {
      const estoque = estoquePorTamanho(g.variacoes);
      const grade = gradeQueCabe(estoque, gradesData || []);
      if (!grade) return null;
      return { ...g, grade_disponivel: grade };
    })
    .filter(Boolean);

  return res.status(200).json({ groups, grades: gradesData || [] });
}