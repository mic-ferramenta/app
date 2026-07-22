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
    const { data, error } = await supabaseAdmin
      .from("price_lists")
      .select("id, slug, created_at, ativo, client:client_id ( id, nome )")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ lists: data || [] });
  }

  if (req.method === "POST") {
    const { bling_customer, items } = req.body || {};

    if (!bling_customer?.bling_id || !bling_customer?.nome) {
      return res.status(400).json({ error: "Cliente é obrigatório." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Selecione ao menos um produto." });
    }
    for (const item of items) {
      if (!item.group_id || item.preco_final === undefined || item.preco_final === "") {
        return res.status(400).json({ error: "Todo item precisa de um preço final." });
      }
    }

    try {
      const client = await findOrCreateClient(bling_customer);
      const slug = await generateUniqueSlug("price_lists", client.nome);

      const { data: priceList, error: listError } = await supabaseAdmin
        .from("price_lists")
        .insert({ client_id: client.id, slug, ativo: true })
        .select("id, slug")
        .single();

      if (listError) throw new Error(listError.message);

      const rows = items.map((item, index) => ({
        price_list_id: priceList.id,
        group_id: item.group_id,
        preco: Number(item.preco_final),
        ordem: index,
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