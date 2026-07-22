// pages/api/admin/login.js
import { checkPassword, createSessionCookie } from "../../../lib/adminSession";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { password } = req.body || {};

  if (!checkPassword(password)) {
    return res.status(401).json({ error: "Senha incorreta." });
  }

  res.setHeader("Set-Cookie", createSessionCookie());
  return res.status(200).json({ ok: true });
}