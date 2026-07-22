// pages/admin/index.js
import Link from "next/link";
import { useRouter } from "next/router";
import { requireAdmin } from "../../lib/adminSession";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { COLORS } from "../../lib/theme";

export default function AdminDashboard({ clients, baseUrl }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Clientes</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/clients/new" style={styles.buttonLink}>
            + Novo cliente
          </Link>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Sair
          </button>
        </div>
      </header>

      <main style={styles.list}>
        {clients.length === 0 && (
          <p style={{ color: COLORS.muted }}>Nenhum cliente cadastrado ainda.</p>
        )}

        {clients.map((c) => (
          <div key={c.id} style={styles.row}>
            <div>
              <p style={styles.rowName}>{c.nome}</p>
              <p style={styles.rowLink}>{`${baseUrl}/lista/${c.slug}`}</p>
            </div>
            <Link href={`/admin/clients/${c.id}`} style={styles.manageLink}>
              Gerenciar lista →
            </Link>
          </div>
        ))}
      </main>
    </div>
  );
}

export async function getServerSideProps({ req }) {
  if (!requireAdmin(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }

  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, nome, slug")
    .order("created_at", { ascending: false });

  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${req.headers.host}`;

  return { props: { clients: clients || [], baseUrl } };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "system-ui, sans-serif",
    padding: "32px 24px",
  },
  header: {
    maxWidth: 800,
    margin: "0 auto 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `3px solid ${COLORS.accent}`,
    paddingBottom: 16,
  },
  title: { margin: 0, fontSize: 24 },
  buttonLink: {
    background: COLORS.accent,
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
  logoutButton: {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 14,
    cursor: "pointer",
  },
  list: {
    maxWidth: 800,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "12px 16px",
  },
  rowName: { margin: 0, fontWeight: 600 },
  rowLink: { margin: "2px 0 0", fontSize: 12, color: COLORS.muted },
  manageLink: {
    color: COLORS.accent,
    fontWeight: 600,
    fontSize: 14,
    textDecoration: "none",
  },
};