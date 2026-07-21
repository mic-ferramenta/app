// GET /api/bling/connect
// Redireciona o usuário para a tela de autorização do Bling (fluxo OAuth2 Authorization Code).
// Isso só precisa ser usado UMA VEZ (ou quando o refresh_token expirar/for revogado).

export default function handler(req, res) {
  const clientId = process.env.BLING_CLIENT_ID;
  const redirectUri = process.env.BLING_REDIRECT_URI; // ex: https://seu-app.vercel.app/api/bling/callback

  // "state" é um valor aleatório só para proteção contra CSRF.
  const state = Math.random().toString(36).slice(2);

  const url = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  // redirect_uri e scope são opcionais na v3 (o Bling usa o que está cadastrado
  // no app), mas não custa nada enviar também.
  if (redirectUri) url.searchParams.set("redirect_uri", redirectUri);

  res.redirect(url.toString());
}