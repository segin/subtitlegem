import { saveGlobalSettings, getGlobalSettings, resetGlobalSettings } from './global-settings-store';
import { DEFAULT_GLOBAL_SETTINGS } from '@/types/subtitle';

// Reuse mocks from draft-store pattern ? 
// Jest mocks are per-file unless in setup. 
import Database from 'better-sqlite3';

jest.mock('better-sqlite3', () => {
  const mRun = jest.fn(() => ({ changes: 1 }));
  const mGet = jest.fn();
  const mPrepare = jest.fn(() => ({
    run: mRun,
    get: mGet
  }));
  const mExec = jest.fn();
  const mPragma = jest.fn();

  const mockClass = jest.fn().mockImplementation(() => ({
    prepare: mPrepare,
    exec: mExec,
    pragma: mPragma,
    close: jest.fn()
  }));

  (mockClass as any).mGet = mGet;
  (mockClass as any).mPrepare = mPrepare;
  (mockClass as any).mRun = mRun;

  return mockClass;
});

const { mGet, mPrepare, mRun } = Database as any;

jest.mock('./storage-config', () => ({
  getStagingDir: () => '/mock/staging',
  ensureStagingStructure: jest.fn()
}));

describe('global-settings-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGlobalSettings', () => {
    it('returns defaults if no settings saved', () => {
      mGet.mockReturnValue(undefined);
      const settings = getGlobalSettings();
      expect(settings).toEqual(DEFAULT_GLOBAL_SETTINGS);
    });

    it('returns saved settings merged with defaults', () => {
      mGet.mockReturnValue({ 
        settings_json: JSON.stringify({ defaultPrimaryLanguage: 'Spanish' }) 
      });
      const settings = getGlobalSettings();
      expect(settings.defaultPrimaryLanguage).toBe('Spanish');
      expect(settings.defaultHwaccel).toBe(DEFAULT_GLOBAL_SETTINGS.defaultHwaccel);
    });
  });

  describe('saveGlobalSettings', () => {
    it('saves settings to db', () => {
      saveGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
      expect(mPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO global_settings'));
      expect(mRun).toHaveBeenCalled();
    });
  });
});
