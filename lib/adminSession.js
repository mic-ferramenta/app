// lib/adminSession.js
//
// Sessão de admin simples baseada em cookie assinado (HMAC), sem tabela
// de usuários. A "senha" fica na env var ADMIN_PASSWORD; a chave usada
// pra assinar o cookie fica em ADMIN_SESSION_SECRET (as duas só existem
// no servidor, nunca chegam ao navegador).

const crypto = require("crypto");

const COOKIE_NAME = "admin_session";
const SESSION_HOURS = 12;

function sign(value) {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(value)
    .digest("hex");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSessionCookie() {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const value = String(expires);
  const token = `${value}.${sign(value)}`;
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${
    SESSION_HOURS * 3600
  }; SameSite=Lax;${secure}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;`;
}

// Aceita tanto o header cru (string) quanto um objeto de cookies já parseado
function isValidSession(cookieHeader) {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  const [value, signature] = match[1].split(".");
  if (!value || !signature) return false;

  const expected = sign(value);
  if (!safeEqual(expected, signature)) return false;
  if (Date.now() > Number(value)) return false;

  return true;
}

function checkPassword(candidate) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!candidate || !real) return false;
  // padStart evita vazar o tamanho da senha real por timing quando os
  // tamanhos são diferentes
  const a = Buffer.from(String(candidate).padEnd(64, "0"));
  const b = Buffer.from(String(real).padEnd(64, "0"));
  return crypto.timingSafeEqual(a, b) && candidate === real;
}

// Uso em getServerSideProps: requireAdmin(req)
function requireAdmin(req) {
  return isValidSession(req.headers.cookie);
}

module.exports = {
  COOKIE_NAME,
  createSessionCookie,
  clearSessionCookie,
  isValidSession,
  checkPassword,
  requireAdmin,
};