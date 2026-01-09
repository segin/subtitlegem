import { saveItem, loadAllItems, updateStatus, getItem } from './queue-db';
import { QueueItem } from './queue-manager';
import Database from 'better-sqlite3';

// Mock better-sqlite3 with the pattern that allows access to spies
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

  (mockClass as any).mGet = mGet;
  (mockClass as any).mAll = mAll;
  (mockClass as any).mPrepare = mPrepare;
  (mockClass as any).mRun = mRun;

  return mockClass;
});

const { mGet, mAll, mPrepare, mRun } = Database as any;

jest.mock('./storage-config', () => ({
  getStagingDir: () => '/mock/staging',
  ensureStagingStructure: jest.fn()
}));

const mockItem: QueueItem = {
    id: '1',
    status: 'pending',
    progress: 0,
    file: { name: 'test.mp4', size: 1000, type: 'video/mp4' },
    createdAt: 1000
};

describe('queue-db', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('saveItem inserts data', () => {
        saveItem(mockItem);
        expect(mPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE'));
        expect(mRun).toHaveBeenCalledWith(expect.objectContaining({
            id: '1',
            fileName: 'test.mp4'
        }));
    });

    test('loadAllItems retrieves formatted items', () => {
        mAll.mockReturnValue([{
            id: '1',
            status: 'pending',
            progress: 0,
            file_name: 'test.mp4',
            file_size: 1000,
            file_type: 'video/mp4',
            created_at: 1000,
            metadata: JSON.stringify({ videoPath: 'path' })
        }]);

        const items = loadAllItems();
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('1');
        expect(items[0].file.name).toBe('test.mp4');
        expect(items[0].metadata).toEqual({ videoPath: 'path' });
    });

    test('updateStatus executes update', () => {
        updateStatus('1', 'processing', 10);
        expect(mPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE queue_items'));
        expect(mRun).toHaveBeenCalledWith(expect.objectContaining({
            id: '1',
            status: 'processing',
            progress: 10
        }));
    });

    test('getItem returns single item or null', () => {
        mGet.mockReturnValue(null);
        expect(getItem('1')).toBeNull();

        mGet.mockReturnValue({
            id: '1',
            status: 'pending',
            progress: 0,
            file_name: 'test.mp4',
            file_size: 1000,
            created_at: 1000 
        });
        const item = getItem('1');
        expect(item).not.toBeNull();
        expect(item?.id).toBe('1');
    });
});
