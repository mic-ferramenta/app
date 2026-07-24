// pages/api/admin/price-lists.js
// GET  /api/admin/price-lists       -> lista as listas já geradas (dashboard)
// POST /api/admin/price-lists       -> gera uma lista nova (cliente + itens)
import { requireAdmin } from "../../../lib/adminSession";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function generateUniqueSlug(table, base) {
  const raiz = slugify(base) || "lista";
  let slug = raiz;
  let tentativa = 0;

  while (true) {
    const { data } = await supabaseAdmin
      .from(table)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;

    tentativa += 1;
    slug = `${raiz}-${Math.random().toString(36).slice(2, 6)}${
      tentativa > 5 ? tentativa : ""
    }`;
  }
}

async function findOrCreateClient(blingCustomer) {
  const { bling_id, nome } = blingCustomer;

  const { data: existente } = await supabaseAdmin
    .from("clients")
    .select("id, nome, slug, bling_contact_id")
    .eq("bling_contact_id", bling_id)
    .maybeSingle();

  if (existente) return existente;

  const slug = await generateUniqueSlug("clients", nome);

  const { data: criado, error } = await supabaseAdmin
    .from("clients")
    .insert({ nome, bling_contact_id: bling_id, slug, ativo: true })
    .select("id, nome, slug, bling_contact_id")
    .single();

  if (error) throw new Error(error.message);
  return criado;
}

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  if (req.method === "GET") {
    const { cliente, data_inicio, data_fim } = req.query;

    let query = supabaseAdmin
      .from("price_lists")
      .select("id, slug, created_at, vencimento, ativo, titulo, mostrar_preco, client:client_id ( id, nome )")
      .order("created_at", { ascending: false });

    if (data_inicio) query = query.gte("created_at", `${data_inicio}T00:00:00`);
    if (data_fim) query = query.lte("created_at", `${data_fim}T23:59:59`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Filtro por nome de cliente OU título é aplicado aqui (mais simples
    // que fazer um "or" dentro de um relacionamento aninhado no PostgREST).
    const termo = String(cliente || "").trim().toLowerCase();
    const lists = termo
      ? (data || []).filter((l) =>
          (l.client?.nome || l.titulo || "").toLowerCase().includes(termo)
        )
      : data || [];

    return res.status(200).json({ lists });
  }

  if (req.method === "POST") {
    const { bling_customer, titulo, items, vencimento, mostrar_preco } = req.body || {};

    const usaTitulo = !bling_customer?.bling_id;

    if (usaTitulo && !String(titulo || "").trim()) {
      return res.status(400).json({ error: "Informe um cliente ou um título para a lista." });
    }
    if (!usaTitulo && !bling_customer?.nome) {
      return res.status(400).json({ error: "Cliente é obrigatório." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Selecione ao menos um produto." });
    }
    for (const item of items) {
      if (!item.pai_id || item.preco_final === undefined || item.preco_final === "") {
        return res.status(400).json({ error: "Todo item precisa de um preço final." });
      }
    }

    try {
      let clientId = null;
      let baseParaSlug;

      if (usaTitulo) {
        baseParaSlug = titulo.trim();
      } else {
        const client = await findOrCreateClient(bling_customer);
        clientId = client.id;
        baseParaSlug = client.nome;
      }

      const slug = await generateUniqueSlug("price_lists", baseParaSlug);

      const { data: priceList, error: listError } = await supabaseAdmin
        .from("price_lists")
        .insert({
          client_id: clientId,
          titulo: usaTitulo ? titulo.trim() : null,
          slug,
          ativo: true,
          vencimento: vencimento || null,
          mostrar_preco: mostrar_preco !== false,
        })
        .select("id, slug")
        .single();

      if (listError) throw new Error(listError.message);

      const rows = items.map((item, index) => ({
        price_list_id: priceList.id,
        pai_id: item.pai_id,
        preco: Number(item.preco_final),
        ordem: index,
        tipo: item.tipo === "grade" ? "grade" : "unidade",
        grade_id: item.tipo === "grade" ? item.grade_id || null : null,
        precos_por_tamanho: item.tipo === "grade" ? item.precos_por_tamanho || null : null,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from("price_list_items")
        .insert(rows);

      if (itemsError) throw new Error(itemsError.message);

      const proto = req.headers["x-forwarded-proto"] || "https";
      const baseUrl = `${proto}://${req.headers.host}`;

      return res.status(200).json({
        slug: priceList.slug,
        url: `${baseUrl}/lista/${priceList.slug}`,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).end();
}