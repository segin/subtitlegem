
describe('Gemini Integration', () => {
    let mockGenerateContent: jest.Mock;
    let mockUpload: jest.Mock;
    let mockGetFile: jest.Mock;
    let generateSubtitles: any;
    let translateSubtitles: any;

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
    });
});
