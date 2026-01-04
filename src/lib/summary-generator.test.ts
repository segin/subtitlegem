
import fs from 'fs';
import { generateProjectSummary } from './summary-generator';
import { generateSummary } from './gemini';

jest.mock('fs');
jest.mock('./gemini', () => ({
  generateSummary: jest.fn(),
}));
jest.mock('./storage-config', () => ({
  getStagingDir: () => '/staging',
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedGenerateSummary = generateSummary as jest.MockedFunction<typeof generateSummary>;

describe('summary-generator', () => {
  const draftId = 'test-draft';
  const subtitles = [
    { id: '1', startTime: 1, endTime: 2, text: 'This is a test transcript for the summary generator.' },
    { id: '2', startTime: 3, endTime: 4, text: 'It should contain enough content to trigger AI generation.' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return cached summary if available and not forced', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ summary: 'Cached Summary' }));

    const summary = await generateProjectSummary(draftId, subtitles);

    expect(summary).toBe('Cached Summary');
    // Ensure it didn't call AI
    expect(mockedGenerateSummary).not.toHaveBeenCalled();
  });

  it('should generate summary if missing', async () => {
    // metadata file doesn't exist
    mockedFs.existsSync.mockReturnValue(false);
    mockedGenerateSummary.mockResolvedValue('AI Generated Summary');

    const summary = await generateProjectSummary(draftId, subtitles);

    expect(summary).toBe('AI Generated Summary');
    expect(mockedGenerateSummary).toHaveBeenCalled();
    // Verify it saved
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it('should regenerate summary if forced', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ summary: 'Old Summary' }));
    mockedGenerateSummary.mockResolvedValue('New Summary');

    const summary = await generateProjectSummary(draftId, subtitles, true);

    expect(summary).toBe('New Summary');
    expect(mockedGenerateSummary).toHaveBeenCalled();
  });

  it('should return null if there are no subtitles', async () => {
    mockedFs.existsSync.mockReturnValue(false); // No cache
    const summary = await generateProjectSummary(draftId, []);
    expect(summary).toBeNull();
  });

  it('should return null if context is too short', async () => {
    mockedFs.existsSync.mockReturnValue(false); // No cache
    const shortSubtitles = [{ id: '1', startTime: 0, endTime: 1, text: 'Too short' }];
    const summary = await generateProjectSummary(draftId, shortSubtitles);
    expect(summary).toBeNull();
  });
});
