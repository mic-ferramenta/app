// pages/admin/clients/new.js
import { useState } from "react";
import { useRouter } from "next/router";
import { requireAdmin } from "../../../lib/adminSession";
import { COLORS } from "../../../lib/theme";

export default function NewClient() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const resp = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });

    const data = await resp.json().catch(() => ({}));
    setCarregando(false);

    if (!resp.ok) {
      setErro(data.error || "Erro ao criar cliente.");
      return;
    }

    router.push(`/admin/clients/${data.client.id}`);
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Novo cliente</h1>
        <input
          type="text"
          placeholder="Nome do cliente"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={styles.input}
          autoFocus
        />
        {erro && <p style={styles.erro}>{erro}</p>}
        <button type="submit" disabled={carregando} style={styles.button}>
          {carregando ? "Criando..." : "Criar e montar lista"}
        </button>
      </form>
    </div>
  );
}

export async function getServerSideProps({ req }) {
  if (!requireAdmin(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  return { props: {} };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    width: 360,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 28,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
  },
  title: { margin: "0 0 8px", fontSize: 20, color: COLORS.text },
  input: {
    padding: "10px 12px",
    borderRadius: 6,
    border: `1px solid ${COLORS.border}`,
    fontSize: 15,
  },
  button: {
    padding: "10px 12px",
    borderRadius: 6,
    border: "none",
    background: COLORS.accent,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  erro: { color: COLORS.danger, fontSize: 13, margin: 0 },
};