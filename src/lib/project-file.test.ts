import { saveProjectFile, loadProjectFile } from './project-file';

// Mock URL
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

describe('project-file', () => {
    test('saveProjectFile downloads file', () => {
        const project = { version: 1, subtitles: [], config: {}, secondaryLanguage: 'en' } as any;
        
        // Mock DOM
        const link = {
            click: jest.fn(),
            href: '',
            download: ''
        };
        const spyCreate = jest.spyOn(document, 'createElement').mockReturnValue(link as any);
        const spyAppend = jest.spyOn(document.body, 'appendChild').mockImplementation();
        const spyRemove = jest.spyOn(document.body, 'removeChild').mockImplementation();

        saveProjectFile(project);

        expect(spyCreate).toHaveBeenCalledWith('a');
        expect(link.download).toContain('.subtitlegem');
        expect(link.click).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    test('loadProjectFile parses content', async () => {
        const file = new File([JSON.stringify({ version: 1, subtitles: [], config: {} })], 'test.json', { type: 'application/json' });
        
        // FileReader in jsdom works?
        // If not, we might need to mock FileReader. Jsdom 16+ supports it.
        // But readAsText might be async in reality, let's see.
        
        const result = await loadProjectFile(file);
        expect(result.version).toBe(1);
    });
    
    test('loadProjectFile rejects invalid content', async () => {
        const file = new File(['invalid json'], 'test.json');
        await expect(loadProjectFile(file)).rejects.toThrow();
    });
});
