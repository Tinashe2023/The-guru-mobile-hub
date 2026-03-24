import rateLimit from "express-rate-limit";

const standardConfig = {
  standardHeaders: true,
  legacyHeaders: false,
};

export const globalLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: "Too many requests, please try again later." },
});

export const authLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts, please try again later." },
});

export const strictAuthLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many verification attempts, please try again later." },
});

export const uploadLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Upload rate exceeded, please try again later." },
});

export const chatLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "Chat request rate exceeded, slow down." },
});
