import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn(async () => undefined);
const getSessionMock = vi.fn(async () => ({ userId: undefined as number | undefined, save: saveMock }));
const getUserByUsernameMock = vi.fn();
const compareMock = vi.fn();

vi.mock("../lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("../lib/storage", () => ({
  storage: {
    getUserByUsername: getUserByUsernameMock,
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: compareMock,
  },
}));

describe("api/login handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when credentials are invalid", async () => {
    const { default: handler } = await import("./login");
    getUserByUsernameMock.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "demo", password: "wrong" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await handler(request);
    const body = (await response.json()) as { error?: { code?: string } };

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it("sets session and succeeds with valid credentials", async () => {
    const { default: handler } = await import("./login");
    getUserByUsernameMock.mockResolvedValue({
      id: 42,
      username: "demo",
      passwordHash: "hash",
      email: "demo@example.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    compareMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "demo", password: "secret" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
