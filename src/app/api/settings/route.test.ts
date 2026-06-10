import { DEFAULT_GLOBAL_SETTINGS, GlobalSettings } from "@/types/subtitle";
import { GET, PUT, DELETE } from "./route";
import type { NextRequest } from "next/server";

// Shape of the JSON payloads returned by the route handlers in these tests.
interface SettingsResponseBody {
  error?: string;
  success?: boolean;
  settings: GlobalSettings;
}

const mockGetGlobalSettings = jest.fn(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));
const mockSaveGlobalSettings = jest.fn((s: GlobalSettings): void => {});
const mockResetGlobalSettings = jest.fn(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));

jest.mock("next/server", () => {
  return {
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => ({
        status: init?.status || 200,
        json: async () => data,
      }),
    },
    NextRequest: class {
      url: string;
      _body: unknown;
      constructor(url: string, init?: { body?: unknown }) {
        this.url = url;
        this._body = init?.body;
      }
      async json() {
        return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
      }
    },
  };
});

jest.mock("@/lib/global-settings-store", () => ({
  getGlobalSettings: () => mockGetGlobalSettings(),
  saveGlobalSettings: (s: GlobalSettings) => mockSaveGlobalSettings(s),
  resetGlobalSettings: () => mockResetGlobalSettings(),
}));

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
      const data = (await res.json()) as SettingsResponseBody;
      expect(data).toEqual(DEFAULT_GLOBAL_SETTINGS);
      expect(mockGetGlobalSettings).toHaveBeenCalled();
    });

    it("should return a 500 status on store error", async () => {
      mockGetGlobalSettings.mockImplementation(() => {
        throw new Error("Store error");
      });
      const res = await GET();
      expect(res.status).toBe(500);
      const data = (await res.json()) as SettingsResponseBody;
      expect(data.error).toBe("Store error");
    });
  });

  describe("PUT Handler", () => {
    it("should merge partial updates and save settings", async () => {
      const partialUpdate = { defaultPrimaryLanguage: "French", defaultCrf: 18 };
      const mockReq = {
        json: async () => partialUpdate,
      } as unknown as NextRequest;

      const res = await PUT(mockReq);
      expect(res.status).toBe(200);
      const data = (await res.json()) as SettingsResponseBody;

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
      } as unknown as NextRequest;
      const res = await PUT(mockReq);
      expect(res.status).toBe(500);
      const data = (await res.json()) as SettingsResponseBody;
      expect(data.error).toBe("Malformed JSON");
    });
  });

  describe("DELETE Handler", () => {
    it("should reset settings to defaults", async () => {
      const res = await DELETE();
      expect(res.status).toBe(200);
      const data = (await res.json()) as SettingsResponseBody;

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
      const data = (await res.json()) as SettingsResponseBody;
      expect(data.error).toBe("Reset failed");
    });
  });
});
