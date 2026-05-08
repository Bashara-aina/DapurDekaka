import { getIronSession, type SessionOptions } from "iron-session";

export interface AppSession {
  userId?: number;
}

export const sessionOptions: SessionOptions = {
  cookieName: "dapurdekaka_session",
  password: process.env.SESSION_SECRET ?? "",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  },
};

type IronReq = Parameters<typeof getIronSession<AppSession>>[0];
type IronRes = Parameters<typeof getIronSession<AppSession>>[1];

export function getSession(req: Request, res: Response) {
  return getIronSession<AppSession>(req as unknown as IronReq, res as unknown as IronRes, sessionOptions);
}
