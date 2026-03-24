import crypto from "crypto";

const getClientOrigin = () => process.env.CLIENT_URL || "http://localhost:5173";

export const enforceHttps = (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (req.secure || forwardedProto === "https") {
    return next();
  }

  return res.status(403).json({ error: "HTTPS is required" });
};

export const issueCsrfCookie = (res) => {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie("csrf_token", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
};

export const csrfTokenEndpoint = (req, res) => {
  const token = issueCsrfCookie(res);
  res.json({ csrfToken: token });
};

export const csrfProtection = (req, res, next) => {
  const method = req.method.toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (!isMutation) {
    return next();
  }

  const csrfExemptPaths = new Set([
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/csrf",
    "/api/webauthn/login/verify",
  ]);
  if (csrfExemptPaths.has(req.path)) {
    return next();
  }

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
};

export const requireSameOrigin = (req, res, next) => {
  const method = req.method.toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (!isMutation) {
    return next();
  }

  const clientOrigin = getClientOrigin();
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin && origin !== clientOrigin) {
    return res.status(403).json({ error: "Cross-origin request blocked" });
  }

  if (!origin && referer && !referer.startsWith(`${clientOrigin}/`)) {
    return res.status(403).json({ error: "Cross-site referer blocked" });
  }

  return next();
};
