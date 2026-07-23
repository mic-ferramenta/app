// pages/index.js
//
// Página pública "vazia" de propósito: quem cair aqui direto (sem link
// pra /admin ou /lista/...) não deve ter nenhuma ação disponível. Sem
// botão, sem link, sem menção a Bling ou a qualquer parte interna do
// sistema -- só a marca e uma mensagem genérica.

export default function Home() {
  return (
    <div style={styles.page}>
      <div style={styles.tarja}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://miccamisasdetime.com.br/cdn/shop/files/Design_sem_nome_-_2026-02-01T085034.319.png?v=1770226222&width=90"
          alt="MIC Camisas de Time"
          style={styles.logo}
        />
      </div>
      <p style={styles.texto}>Sistema interno.</p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  tarja: {
    width: "100%",
    background: "#000000",
    padding: "28px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    height: 48,
    width: "auto",
  },
  texto: {
    marginTop: 20,
    fontSize: 14,
    color: "#888888",
  },
};