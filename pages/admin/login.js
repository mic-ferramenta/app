// pages/admin/login.js
import { useState } from "react";
import { useRouter } from "next/router";
import { COLORS, FONT } from "../../lib/theme";

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
      <div style={styles.glow} />
      <form onSubmit={handleSubmit} style={styles.card}>
        <p style={styles.brand}>MIC · PAINEL</p>
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
    fontFamily: FONT,
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: COLORS.accentSoft,
    filter: "blur(80px)",
    top: "-10%",
    left: "50%",
    transform: "translateX(-50%)",
  },
  card: {
    position: "relative",
    width: 340,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 32,
    background: COLORS.bgCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  brand: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 3,
    color: COLORS.accent,
    textTransform: "uppercase",
  },
  title: { margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: COLORS.text },
  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgAlt,
    color: COLORS.text,
    fontSize: 15,
    outline: "none",
  },
  button: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "none",
    background: COLORS.accent,
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
  erro: { color: COLORS.danger, fontSize: 13, margin: 0 },
};