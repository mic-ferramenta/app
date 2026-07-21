export default function Home() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 40 }}>
      <h1>Painel de integração Bling</h1>
      <p>
        Clique no botão abaixo <strong>uma única vez</strong> para autorizar
        este app a acessar sua conta Bling. Isso vai gerar o access_token e o
        refresh_token, que ficam salvos no Supabase e são usados depois pelo
        GitHub Actions.
      </p>
      <a href="/api/bling/connect">
        <button style={{ padding: "10px 20px", fontSize: 16 }}>
          Conectar com o Bling
        </button>
      </a>
    </div>
  );
}