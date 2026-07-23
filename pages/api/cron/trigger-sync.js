// pages/api/cron/trigger-sync.js
//
// Dispara o workflow "Sync Bling Products" via API do GitHub, em vez de
// depender do agendamento interno do GitHub Actions (schedule), que não
// tem horário garantido em runners compartilhados.
//
// Chame essa rota a partir de um cron EXTERNO (ex: cron-job.org, a cada
// 5 ou 10 minutos), passando o segredo configurado:
//   GET https://SEU-DOMINIO/api/cron/trigger-sync?secret=SEU_CRON_SECRET
//
// Variáveis de ambiente necessárias (Vercel → Settings → Environment Variables):
//   CRON_SECRET        -> uma string aleatória qualquer, só você e o cron externo sabem
//   GITHUB_TOKEN        -> Personal Access Token com escopo "Actions: write" no repositório
//   GITHUB_REPO         -> "usuario/repositorio", ex: "mic-ferramenta/app"
//   GITHUB_REF          -> branch a disparar, normalmente "main" (opcional, default "main")

export default async function handler(req, res) {
  const secretEsperado = process.env.CRON_SECRET;
  const secretRecebido = req.query.secret || req.headers["x-cron-secret"];

  if (!secretEsperado) {
    return res.status(500).json({ error: "CRON_SECRET não configurado no servidor." });
  }
  if (secretRecebido !== secretEsperado) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_REF || "main";

  if (!token || !repo) {
    return res.status(500).json({
      error: "GITHUB_TOKEN e/ou GITHUB_REPO não configurados no servidor.",
    });
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/sync-bling.yml/dispatches`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref }),
  });

  if (resp.status === 204) {
    return res.status(200).json({ ok: true, disparado_em: new Date().toISOString() });
  }

  const texto = await resp.text().catch(() => "");
  return res.status(502).json({
    error: `GitHub API respondeu ${resp.status}`,
    detalhe: texto,
  });
}