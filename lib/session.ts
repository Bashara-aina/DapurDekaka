import {
  getIronSession,
  type IronSession,
  type SessionOptions,
} from "iron-session";

export interface AppSession {
  userId?: number;
  role?: string;
}

/**
 * Secure cookies whenever the inbound request is HTTPS (Vercel, x-forwarded-proto,
 * or https:// dev). Relying on NODE_ENV alone breaks local HTTPS and preview URLs
 * that are not "production" but still require SameSite=None + Secure.
 */
function isRequestSecure(request: Request): boolean {
  if (process.env.VERCEL === "1") return true;
  try {
    if (new URL(request.url).protocol === "https:") return true;
  } catch {
    // ignore malformed URL
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first === "https") return true;
  }
  return false;
}

/**
 * Builds iron-session options for this request so cookie flags match transport security.
 */
export function sessionOptionsForRequest(request: Request): SessionOptions {
  const secure = isRequestSecure(request);
  return {
    cookieName: "dapurdekaka_session",
    password: process.env.SESSION_SECRET ?? "",
    cookieOptions: {
      secure,
      httpOnly: true,
      sameSite: secure ? "none" : "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    },
  };
}

export interface SessionContext {
  session: IronSession<AppSession>;
  sessionResponse: Response;
  save: () => Promise<void>;
}

/**
 * Loads the encrypted session from the request Cookie header and binds mutations
 * (save / destroy) to `sessionResponse` Set-Cookie headers.
 */
export async function getSession(
  request: Request,
  sessionResponse: Response
): Promise<SessionContext> {
  const session = await getIronSession<AppSession>(
    request,
    sessionResponse,
    sessionOptionsForRequest(request)
  );
  return {
    session,
    sessionResponse,
    save: () => session.save(),
  };
}

type HeadersWithGetSetCookie = Headers & {
  getSetCookie?: () => string[];
};

/**
 * Copies Set-Cookie headers produced by iron-session onto the handler's final Response.
 */
export function withSessionHeaders(
  response: Response,
  sessionResponse: Response
): Response {
  const merged = new Headers(response.headers);
  const source = sessionResponse.headers as HeadersWithGetSetCookie;
  if (typeof source.getSetCookie === "function") {
    for (const cookie of source.getSetCookie()) {
      merged.append("Set-Cookie", cookie);
    }
  } else {
    const single = sessionResponse.headers.get("Set-Cookie");
    if (single) merged.append("Set-Cookie", single);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
