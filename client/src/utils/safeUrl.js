const FALLBACK_LINK = "#";
const FALLBACK_IMAGE = "/default-avatar.svg";

const isAllowedProtocol = (protocol) =>
  protocol === "http:" || protocol === "https:";

export const sanitizeUrl = (value, fallback = FALLBACK_LINK) => {
  if (!value || typeof value !== "string") return fallback;

  try {
    const parsed = new URL(value, window.location.origin);
    if (!isAllowedProtocol(parsed.protocol)) {
      return fallback;
    }
    return parsed.href;
  } catch {
    return fallback;
  }
};

export const safeHref = (value) => sanitizeUrl(value, FALLBACK_LINK);
export const safeImageSrc = (value) => sanitizeUrl(value, FALLBACK_IMAGE);
