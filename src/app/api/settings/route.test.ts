import { expect, it, describe, mock, beforeEach } from "bun:test";
import { DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";

/**
 * Settings API Route Tests
 *
 * Tests the GET, PUT, and DELETE handlers for the global settings API.
 * Uses Bun's module mocking to isolate the handlers from external dependencies
 * like next/server and the global-settings-store.
 */

// 1. Register mocks BEFORE loading the handlers
mock.module("next/server", () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status || 200,
      json: async () => data,
    }),
  },
  NextRequest: class {
    url: string;
    _body: any;
    constructor(url: string, init?: any) {
      this.url = url;
      this._body = init?.body;
    }
    async json() {
      return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
    }
  },
}));

const mockGetGlobalSettings = mock(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));
const mockSaveGlobalSettings = mock(() => {});
const mockResetGlobalSettings = mock(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));

mock.module("@/lib/global-settings-store", () => ({
  getGlobalSettings: mockGetGlobalSettings,
  saveGlobalSettings: mockSaveGlobalSettings,
  resetGlobalSettings: mockResetGlobalSettings,
}));

// 2. Load handlers using require to ensure they pick up the registered mocks
// (Static imports would be resolved before the mocks are applied in Bun)
const { GET, PUT, DELETE } = require("./route");

describe("/api/settings", () => {
  beforeEach(() => {
    mockGetGlobalSettings.mockClear();
    mockSaveGlobalSettings.mockClear();
    mockResetGlobalSettings.mockClear();

    // Reset implementations to default successful behaviors
    mockGetGlobalSettings.mockImplementation(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));
    mockResetGlobalSettings.mockImplementation(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));
  });

  describe("GET Handler", () => {
    it("should return the current global settings", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data).toEqual(DEFAULT_GLOBAL_SETTINGS);
      expect(mockGetGlobalSettings).toHaveBeenCalled();
    });

    it("should return a 500 status on store error", async () => {
      mockGetGlobalSettings.mockImplementation(() => {
        throw new Error("Store error");
      });
      const res = await GET();
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe("Store error");
    });
  });

  describe("PUT Handler", () => {
    it("should merge partial updates and save settings", async () => {
      const partialUpdate = { defaultPrimaryLanguage: "French", defaultCrf: 18 };
      const mockReq = {
        json: async () => partialUpdate,
      } as any;

      const res = await PUT(mockReq);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;

      expect(data.success).toBe(true);
      expect(data.settings.defaultPrimaryLanguage).toBe("French");
      expect(data.settings.defaultCrf).toBe(18);
      // Ensure other fields are preserved from defaults
      expect(data.settings.defaultPreset).toBe(DEFAULT_GLOBAL_SETTINGS.defaultPreset);

      expect(mockSaveGlobalSettings).toHaveBeenCalled();
    });

    it("should return a 500 status on invalid request body", async () => {
      const mockReq = {
        json: async () => {
          throw new Error("Malformed JSON");
        },
      } as any;
      const res = await PUT(mockReq);
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe("Malformed JSON");
    });
  });

  describe("DELETE Handler", () => {
    it("should reset settings to defaults", async () => {
      const res = await DELETE();
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;

      expect(data.success).toBe(true);
      expect(data.settings).toEqual(DEFAULT_GLOBAL_SETTINGS);
      expect(mockResetGlobalSettings).toHaveBeenCalled();
    });

    it("should return a 500 status on reset failure", async () => {
      mockResetGlobalSettings.mockImplementation(() => {
        throw new Error("Reset failed");
      });
      const res = await DELETE();
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe("Reset failed");
    });
  });
});
