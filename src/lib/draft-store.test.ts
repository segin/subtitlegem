import { saveDraftV1, loadDraft, saveDraftV2 } from './draft-store';
import { SubtitleConfig } from '@/types/subtitle';

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
  (mockClass as any).mGet = mGet;
  (mockClass as any).mPrepare = mPrepare;
  
  return mockClass;
});

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

const { mGet, mPrepare } = Database as any;

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
        projectConfig: {} as any,
        subtitleConfig: {} as any
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
});
