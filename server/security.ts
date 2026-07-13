import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function createFirebaseAuthMiddleware(
  projectId: string,
  required: boolean,
): RequestHandler {
  return async (req, res, next) => {
    if (!required) {
      next();
      return;
    }

    const authorization = req.header("authorization");
    const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    try {
      const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
        algorithms: ["RS256"],
      });

      if (!payload.sub) {
        throw new Error("Token does not contain a subject");
      }
      res.locals.user = { uid: payload.sub, claims: payload };
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired authentication token" });
    }
  };
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;

  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertPublicHttpUrl(rawUrl: unknown): Promise<URL> {
  if (typeof rawUrl !== "string" || rawUrl.length > 2_048) {
    throw new HttpError(400, "A valid URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "A valid URL is required");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, "Only HTTP and HTTPS URLs are supported");
  }
  if (parsed.username || parsed.password) {
    throw new HttpError(400, "URLs containing credentials are not supported");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new HttpError(400, "Private network URLs are not allowed");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => {
        throw new HttpError(400, "The URL hostname could not be resolved");
      });

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new HttpError(400, "Private network URLs are not allowed");
  }

  return parsed;
}

async function readLimitedText(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    throw new HttpError(413, "The remote page is too large");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "The remote page is too large");
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function fetchPublicText(
  rawUrl: unknown,
  options: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<{ text: string; finalUrl: URL; contentType: string }> {
  const maxBytes = options.maxBytes ?? 1_000_000;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = await assertPublicHttpUrl(rawUrl);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "text/html, text/plain;q=0.9",
        "User-Agent": "Memora-WebClipper/1.0",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === maxRedirects) {
        throw new HttpError(400, "The URL redirected too many times");
      }
      currentUrl = await assertPublicHttpUrl(
        new URL(location, currentUrl).toString(),
      );
      continue;
    }

    if (!response.ok) {
      throw new HttpError(502, `Remote server returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!/^(text\/html|text\/plain)(?:;|$)/i.test(contentType)) {
      throw new HttpError(415, "The URL did not return an HTML or text page");
    }

    return {
      text: await readLimitedText(response, maxBytes),
      finalUrl: currentUrl,
      contentType,
    };
  }

  throw new HttpError(400, "The URL redirected too many times");
}

export function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${field} is required`);
  }
  if (value.length > maxLength) {
    throw new HttpError(413, `${field} exceeds the ${maxLength} character limit`);
  }
  return value;
}
