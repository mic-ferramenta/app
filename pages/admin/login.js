// pages/admin/login.js
import { useState } from "react";
import { useRouter } from "next/router";
import { COLORS } from "../../lib/theme";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const resp = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setCarregando(false);

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setErro(data.error || "Erro ao entrar.");
      return;
    }

    router.push("/admin");
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Área administrativa</h1>
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          autoFocus
        />
        {erro && <p style={styles.erro}>{erro}</p>}
        <button type="submit" disabled={carregando} style={styles.button}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
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
    width: 320,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 28,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
  },
  title: {
    margin: "0 0 8px",
    fontSize: 20,
    color: COLORS.text,
  },
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
  erro: {
    color: COLORS.danger,
    fontSize: 13,
    margin: 0,
  },
};