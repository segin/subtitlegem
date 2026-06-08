import { DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { GET, PUT, DELETE } from "./route";
import { NextRequest } from "next/server";

const mockGetGlobalSettings = jest.fn(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));
const mockSaveGlobalSettings = jest.fn((s: any) => {});
const mockResetGlobalSettings = jest.fn(() => ({ ...DEFAULT_GLOBAL_SETTINGS }));

jest.mock("next/server", () => {
  return {
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
  };
});

jest.mock("@/lib/global-settings-store", () => ({
  getGlobalSettings: () => mockGetGlobalSettings(),
  saveGlobalSettings: (s: any) => mockSaveGlobalSettings(s),
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
