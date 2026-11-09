
describe('Gemini Integration', () => {
    let mockGenerateContent: jest.Mock;
    let mockUpload: jest.Mock;
    let mockGetFile: jest.Mock;
    type GeminiModule = typeof import('./gemini');
    let generateSubtitles: GeminiModule['generateSubtitles'];
    let generateSubtitlesInline: GeminiModule['generateSubtitlesInline'];
    let translateSubtitles: GeminiModule['translateSubtitles'];

    beforeEach(async () => {
        jest.resetModules();
        
        mockGenerateContent = jest.fn();
        mockUpload = jest.fn();
        mockGetFile = jest.fn();

        jest.doMock('@google/genai', () => ({
            GoogleGenAI: jest.fn(() => ({
                models: {
                    generateContent: mockGenerateContent
                },
                files: {
                    upload: mockUpload,
                    get: mockGetFile
                }
            })),
            FileState: {
                PROCESSING: 'PROCESSING',
                ACTIVE: 'ACTIVE',
                FAILED: 'FAILED'
            },
            HarmCategory: {},
            HarmBlockThreshold: {}
        }));

        const gemini = await import('./gemini');
        generateSubtitles = gemini.generateSubtitles;
        generateSubtitlesInline = gemini.generateSubtitlesInline;
        translateSubtitles = gemini.translateSubtitles;
    });

    describe('generateSubtitles', () => {
        it('cleans markdown from JSON response', async () => {
            const markdownJson = '```json\n{"detectedLanguage": "en", "subtitles": []}\n```';
            
            mockGenerateContent.mockResolvedValueOnce({
                text: markdownJson
            });

            const result = await generateSubtitles('test-uri', 'video/mp4');
            
            expect(result).toEqual({
                detectedLanguage: "en",
                subtitles: []
            });
        });

        it('cleans raw markdown blocks without json tag', async () => {
            const markdownJson = '```\n{"detectedLanguage": "en", "subtitles": []}\n```';
            
            mockGenerateContent.mockResolvedValueOnce({
                text: markdownJson
            });

            const result = await generateSubtitles('test-uri', 'video/mp4');
            
            expect(result).toEqual({
                detectedLanguage: "en",
                subtitles: []
            });
        });

        it('parses clean JSON correctly', async () => {
            const cleanJson = '{"detectedLanguage": "en", "subtitles": []}';
            
            mockGenerateContent.mockResolvedValueOnce({
                text: cleanJson
            });

            const result = await generateSubtitles('test-uri', 'video/mp4');
            
            expect(result).toEqual({
                detectedLanguage: "en",
                subtitles: []
            });
        });
    });

    describe('generateSubtitlesInline', () => {
        it('handles inline data correctly', async () => {
            const cleanJson = '{"detectedLanguage": "en", "subtitles": []}';

            mockGenerateContent.mockResolvedValueOnce({
                text: cleanJson
            });

            const result = await generateSubtitlesInline('base64data', 'video/mp4');

            expect(result).toEqual({
                detectedLanguage: "en",
                subtitles: []
            });

            // Verify it was called with inlineData
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'video/mp4',
                                    data: 'base64data',
                                },
                            },
                            expect.any(Object),
                        ],
                    },
                ],
            }));
        });
    });

    describe('translateSubtitles', () => {
        it('cleans markdown from translation response', async () => {
            const markdownJson = '```json\n{"subtitles": [{"text": "Hello"}]}\n```';
            
            mockGenerateContent.mockResolvedValueOnce({
                text: markdownJson
            });

            const result = await translateSubtitles([], 'es');
            
            expect(result).toEqual([{ text: "Hello" }]);
        });

        it('handles array response directly', async () => {
            const markdownJson = '```json\n[{"text": "Hello"}]\n```';
            
            mockGenerateContent.mockResolvedValueOnce({
                text: markdownJson
            });

            const result = await translateSubtitles([], 'es');

            expect(result).toEqual([{ text: "Hello" }]);
        });

        it('sends only the text and asks Gemini 3 models for low thinking', async () => {
            mockGenerateContent.mockResolvedValue({ text: '{"subtitles": []}' });
            const lines = [{ id: 'a', startTime: 12.5, endTime: 14, text: 'See you next week.' }];

            await translateSubtitles(lines, 'Simplified Chinese', 'gemini-3.8-flash');
            const request = mockGenerateContent.mock.calls[0][0];
            const prompt: string = request.contents[0].parts[0].text;

            expect(prompt).toContain('[{"text":"See you next week."}]');
            expect(prompt).not.toContain('12.5');
            expect(request.config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });

            // Context lines reach the prompt
            await translateSubtitles(lines, 'Simplified Chinese', 'gemini-3.8-flash', { before: ['Previous line'], after: ['Next line'] });
            expect(mockGenerateContent.mock.calls[1][0].contents[0].parts[0].text).toContain('["Previous line"]');
            mockGenerateContent.mockClear();

            // Older models don't accept thinkingLevel
            await translateSubtitles(lines, 'Simplified Chinese', 'gemini-2.5-flash');
            expect(mockGenerateContent.mock.calls[0][0].config).not.toHaveProperty('thinkingConfig');
        });
    });
});
