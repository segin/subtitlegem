import { buildTranslationPrompt } from './translation-prompt';

describe('buildTranslationPrompt', () => {
  const line = [{ text: 'Oh no! Josie!' }];

  it('sends only the text of the lines to translate', () => {
    const prompt = buildTranslationPrompt([{ text: 'a' }, { text: 'b' }], 'Simplified Chinese');
    expect(prompt).toContain('into Simplified Chinese');
    expect(prompt).toContain('[{"text":"a"},{"text":"b"}]');
    expect(prompt).toContain('exactly 2 object(s)');
    expect(prompt).not.toMatch(/startTime|endTime|context only/);
  });

  it('includes neighbouring lines as context around the target line', () => {
    const prompt = buildTranslationPrompt(line, 'Simplified Chinese', {
      before: ['Hey there'],
      after: ["Josie's on vacation far away", 'Come around and talk it over'],
    });

    const before = prompt.indexOf('Lines before (context only):');
    const target = prompt.indexOf('Subtitles to translate:');
    const after = prompt.indexOf('Lines after (context only):');
    expect(before).toBeGreaterThan(-1);
    expect(before).toBeLessThan(target);
    expect(target).toBeLessThan(after);
    expect(prompt).toContain('["Josie\'s on vacation far away","Come around and talk it over"]');
    expect(prompt).toContain('Do not translate them or include them in the output');
    expect(prompt).toContain('exactly 1 object(s)');
  });

  it('omits empty context sections', () => {
    const prompt = buildTranslationPrompt(line, 'French', { before: [], after: ['', 'Next line'] });
    expect(prompt).not.toContain('Lines before');
    expect(prompt).toContain('Lines after (context only):\n["Next line"]');
  });
});
