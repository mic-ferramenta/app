import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Autorização negada pelo Bling: ${error}`);
  }
  if (!code) {
    return res.status(400).send("Parâmetro 'code' ausente na URL de callback.");
  }

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  const redirectUri = process.env.BLING_REDIRECT_URI;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const tokenResp = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResp.json();

    if (!tokenResp.ok) {
      console.error("Erro ao trocar o code pelos tokens:", tokenData);
      return res
        .status(500)
        .send(`Erro ao obter tokens do Bling: ${JSON.stringify(tokenData)}`);
    }

    // tokenData
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error: dbError } = await supabase.from("bling_tokens").upsert({
      id: 1,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("Erro ao salvar tokens no Supabase:", dbError);
      return res.status(500).send(`Erro ao salvar tokens no Supabase: ${dbError.message}`);
    }

    return res
      .status(200)
      .send("Conta Bling conectada com sucesso! Você já pode fechar esta aba.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(`Erro inesperado: ${err.message}`);
  }
}