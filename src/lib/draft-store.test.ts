import { saveDraftV1, saveDraftV2, renameDraft, deleteDraft, DraftVersionConflictError } from './draft-store';
import fs from 'fs';
import { SubtitleConfig, ProjectConfig } from '@/types/subtitle';

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  const mRun = jest.fn(() => ({ changes: 1 }));
  const mGet = jest.fn();
  const mAll = jest.fn();
  const mPrepare = jest.fn(() => ({
    run: mRun,
    get: mGet,
    all: mAll
  }));
  const mExec = jest.fn();
  const mPragma = jest.fn();
  
  const mockClass = jest.fn().mockImplementation(() => ({
    prepare: mPrepare,
    exec: mExec,
    pragma: mPragma,
    close: jest.fn()
  }));

  // Attach explicit spies to the class checking static properties/custom assignment isn't easy 
  // without require, but we can rely on variable capture if we don't need to change return values?
  // We DO need to change return values (mockGet.mockReturnValue).
  // So we export them via a side channel or use global.__MOCKS__ if needed, but easier:
  // Since we can't export from factory, we use 'require' in the test to get the mocked module,
  // then assume the constructor returns our spy objects?
  // No, better to use the pattern:
  // const { mockGet } = require('better-sqlite3'); if we exposed it on the mock.
  
  // Let's attach them to the mock function for access
  const decorated = mockClass as unknown as DatabaseMockSpies;
  decorated.mGet = mGet;
  decorated.mPrepare = mPrepare;

  return mockClass;
});

interface DatabaseMockSpies {
  mGet: jest.Mock;
  mPrepare: jest.Mock;
}

// Mock fs and path via storage-config mock effectively (or just let them run if they use mock-fs? No, jest mock)
// storage-config exports ensureStagingStructure. 
jest.mock('./storage-config', () => ({
  getStagingDir: () => '/mock/staging',
  ensureStagingStructure: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  unlinkSync: jest.fn(),
  rmSync: jest.fn()
}));

jest.mock('uuid', () => ({
  v4: () => 'test-uuid-v4'
}));


// Access mocks from the module
import Database from 'better-sqlite3';

const { mGet, mPrepare } = Database as unknown as DatabaseMockSpies;

describe('draft-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default get behavior: return null
    mGet.mockReturnValue(null);
  });

  describe('saveDraftV1', () => {
    it('saves a new draft', () => {
      // Setup mock to return the inserted draft on load
      const draftInput = { name: 'Test Draft' };
      
      // First check for existence (returns null)
      mGet.mockReturnValueOnce(null); 
      
      // Then loadDraft calls get again
      mGet.mockReturnValueOnce({
        id: 'uuid',
        name: 'Test Draft',
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now()
      });

      const result = saveDraftV1(draftInput);
      
      expect(mPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO drafts'));
      expect(result.name).toBe('Test Draft');
    });
  });

  describe('saveDraftV2', () => {
    it('updates existing draft to V2', () => {
      const v2Input = {
        id: 'existing-id',
        name: 'V2 Draft',
        clips: [],
        timeline: [],
        projectConfig: {} as unknown as ProjectConfig,
        subtitleConfig: {} as unknown as SubtitleConfig
      };

      // Check existence
      mGet.mockReturnValueOnce({ id: 'existing-id' }); 
      
      // Load draft return
      mGet.mockReturnValueOnce({
        id: 'existing-id',
        name: 'V2 Draft',
        version: 2,
        clips: '[]',
        timeline: '[]',
        created_at: Date.now(),
        updated_at: Date.now()
      });

      saveDraftV2(v2Input);

      expect(mPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE drafts SET'));
    });
  });

  describe('renameDraft', () => {
    it('renames an existing draft', () => {
      const id = 'existing-id';
      const newName = 'Renamed Draft';
      
      const result = renameDraft(id, newName);
      
      expect(mPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE drafts SET'));
      expect(result).toBe(true);
    });

    it('returns false if draft not found/not updated', () => {
        // Force the next run to return changes: 0 by utilizing the mock behavior we set up or want to setup
        // The mock defined at top returns { changes: 1 }. 
        // We can use mRun.mockReturnValueOnce({ changes: 0 }) if we had access to mRun.
        // We access mPrepare. 
        // mPrepare returns an object with run(), so we need to mock THAT return value.
        // Since mPrepare is a jest.fn(), we can make it return a specific object for one call.
        
        mPrepare.mockReturnValueOnce({
            run: jest.fn(() => ({ changes: 0 })),
            get: jest.fn(),
            all: jest.fn()
        });

        const result = renameDraft('non-existent', 'New Name');
        expect(result).toBe(false);
    });
  });

  describe('draft ID validation', () => {
    it('refuses to save a draft with a path-traversal ID', () => {
      expect(() => saveDraftV1({ id: '../../../home/user', name: 'x' })).toThrow('Invalid draft ID');
      expect(mPrepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO drafts'));
    });

    it('deletes a legacy row with an unsafe ID without touching the filesystem', () => {
      mGet.mockReturnValueOnce({
        id: '../../../home/user',
        name: 'evil',
        version: 1,
        video_path: '/mock/staging/temp/video.mp4',
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      expect(deleteDraft('../../../home/user')).toBe(true);
      expect(fs.rmSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(mPrepare).toHaveBeenCalledWith('DELETE FROM drafts WHERE id = ?');

      (fs.existsSync as jest.Mock).mockReturnValue(false);
    });
  });

  describe('autosave data-loss guards', () => {
    // All prepared statements share one run() spy
    const runCalls = () => (mPrepare.mock.results[0].value.run as jest.Mock).mock.calls;

    it('refuses a single-video save over a multi-video draft', () => {
      mGet.mockReturnValueOnce({ id: 'multi', version: 2 });

      expect(() => saveDraftV1({ id: 'multi', subtitles: [] })).toThrow(DraftVersionConflictError);
      expect(mPrepare).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE drafts SET'));
    });

    it('keeps the stored name when an update omits it', () => {
      mGet.mockReturnValueOnce({ id: 'd1', version: 1 });
      mGet.mockReturnValueOnce({ id: 'd1', name: 'Renamed', version: 1, created_at: 0, updated_at: 0 });

      saveDraftV1({ id: 'd1', subtitles: [] });

      expect(mPrepare).toHaveBeenCalledWith(expect.stringContaining('name = COALESCE(?, name)'));
      const update = runCalls().find(args => args[args.length - 1] === 'd1');
      expect(update?.[0]).toBeNull();
    });

    it('persists and reloads timeline images on V2 drafts', () => {
      const imageAssets = [{ id: 'img', filePath: '/mock/staging/i.png', originalFilename: 'i.png', width: 10, height: 10 }];
      const timelineImages = [{ id: 'ti', type: 'image' as const, imageAssetId: 'img', projectStartTime: 5, duration: 3 }];

      mGet.mockReturnValueOnce(null);
      mGet.mockReturnValueOnce({
        id: 'test-uuid-v4', name: 'P', version: 2, clips: '[]', timeline: '[]',
        image_assets: JSON.stringify(imageAssets), timeline_images: JSON.stringify(timelineImages),
        created_at: 0, updated_at: 0,
      });

      const draft = saveDraftV2({
        name: 'P', clips: [], timeline: [],
        projectConfig: {} as unknown as ProjectConfig,
        subtitleConfig: {} as unknown as SubtitleConfig,
        imageAssets, timelineImages,
      });

      const insert = runCalls().find(args => args[0] === 'test-uuid-v4');
      expect(insert).toContain(JSON.stringify(imageAssets));
      expect(insert).toContain(JSON.stringify(timelineImages));
      expect(draft.imageAssets).toEqual(imageAssets);
      expect(draft.timelineImages).toEqual(timelineImages);
    });
  });
});
