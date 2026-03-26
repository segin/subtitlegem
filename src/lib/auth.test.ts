import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { validateAuth, isAuthEnabled } from "./auth";
import { NextRequest } from "next/server";

describe("auth.ts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isAuthEnabled", () => {
    test("returns false when API_PASSWORD is not set", () => {
      delete process.env.API_PASSWORD;
      expect(isAuthEnabled()).toBe(false);
    });

    test("returns false when API_PASSWORD is empty string", () => {
      process.env.API_PASSWORD = "";
      expect(isAuthEnabled()).toBe(false);
    });

    test("returns false when API_PASSWORD is only whitespace", () => {
      process.env.API_PASSWORD = "   ";
      expect(isAuthEnabled()).toBe(false);
    });

    test("returns true when API_PASSWORD is set", () => {
      process.env.API_PASSWORD = "secure-password";
      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe("validateAuth", () => {
    const mockRequest = (headers: Record<string, string> = {}, cookies: Record<string, string> = {}) => {
      return {
        headers: {
          get: (name: string) => headers[name.toLowerCase()] || null,
        },
        cookies: {
          get: (name: string) => cookies[name] ? { value: cookies[name] } : null,
        },
      } as unknown as NextRequest;
    };

    test("returns true when authentication is disabled", () => {
      delete process.env.API_PASSWORD;
      const req = mockRequest();
      expect(validateAuth(req)).toBe(true);
    });

    test("returns true with valid Bearer token", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({ authorization: "Bearer secure-password" });
      expect(validateAuth(req)).toBe(true);
    });

    test("returns true with valid Bearer token (case insensitive type)", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({ authorization: "bearer secure-password" });
      expect(validateAuth(req)).toBe(true);
    });

    test("returns true with plain password in Authorization header", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({ authorization: "secure-password" });
      expect(validateAuth(req)).toBe(true);
    });

    test("returns true with valid X-API-Key header", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({ "x-api-key": "secure-password" });
      expect(validateAuth(req)).toBe(true);
    });

    test("returns true with valid cookie", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({}, { sb_api_key: "secure-password" });
      expect(validateAuth(req)).toBe(true);
    });

    test("returns false with invalid Authorization header", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({ authorization: "Bearer wrong-password" });
      expect(validateAuth(req)).toBe(false);
    });

    test("returns false with invalid X-API-Key header", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({ "x-api-key": "wrong-password" });
      expect(validateAuth(req)).toBe(false);
    });

    test("returns false with invalid cookie", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest({}, { sb_api_key: "wrong-password" });
      expect(validateAuth(req)).toBe(false);
    });

    test("returns false when no auth provided and auth is enabled", () => {
      process.env.API_PASSWORD = "secure-password";
      const req = mockRequest();
      expect(validateAuth(req)).toBe(false);
    });
  });
});
