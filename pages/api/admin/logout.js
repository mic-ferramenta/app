// pages/api/admin/logout.js
import { clearSessionCookie } from "../../../lib/adminSession";

export default function handler(req, res) {
  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ ok: true });
}