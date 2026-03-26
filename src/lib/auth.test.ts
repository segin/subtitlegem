import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { validateAuth, isAuthEnabled } from "./auth";
import { NextRequest } from "next/server";

// Mock NextRequest since we are in a unit test environment
const mockRequest = (headers: Record<string, string> = {}, cookies: Record<string, string> = {}) => {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
    cookies: {
      get: (name: string) => cookies[name] ? { value: cookies[name] } : null,
    },
    nextUrl: {
        pathname: '/api/test'
    }
  } as unknown as NextRequest;
};

describe("auth utility", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("validateAuth", () => {
    it("should return false when API_PASSWORD is NOT set (FIX VERIFICATION)", () => {
      delete process.env.API_PASSWORD;
      const req = mockRequest();
      // Fixed behavior returns false
      expect(validateAuth(req)).toBe(false);
    });

    it("should return false when API_PASSWORD is empty string (FIX VERIFICATION)", () => {
      process.env.API_PASSWORD = "";
      const req = mockRequest();
      // Fixed behavior returns false
      expect(validateAuth(req)).toBe(false);
    });

    it("should return false when API_PASSWORD is set but no credentials provided", () => {
      process.env.API_PASSWORD = "secret-password";
      const req = mockRequest();
      expect(validateAuth(req)).toBe(false);
    });

    it("should return true with correct Authorization Bearer header", () => {
      process.env.API_PASSWORD = "secret-password";
      const req = mockRequest({ authorization: "Bearer secret-password" });
      expect(validateAuth(req)).toBe(true);
    });

    it("should return true with correct X-API-Key header", () => {
      process.env.API_PASSWORD = "secret-password";
      const req = mockRequest({ "x-api-key": "secret-password" });
      expect(validateAuth(req)).toBe(true);
    });

    it("should return true with correct cookie", () => {
      process.env.API_PASSWORD = "secret-password";
      const req = mockRequest({}, { sb_api_key: "secret-password" });
      expect(validateAuth(req)).toBe(true);
    });
  });

  describe("isAuthEnabled", () => {
    it("should return false when API_PASSWORD is not set", () => {
      delete process.env.API_PASSWORD;
      expect(isAuthEnabled()).toBe(false);
    });

    it("should return true when API_PASSWORD is set", () => {
      process.env.API_PASSWORD = "secret-password";
      expect(isAuthEnabled()).toBe(true);
    });
  });
});
