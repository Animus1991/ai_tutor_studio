import { describe, expect, it } from 'vitest';
import { textDirectionForLanguage } from '../i18n';

describe('textDirectionForLanguage (RTL-ready)', () => {
  it('keeps EL/EN as LTR', () => {
    expect(textDirectionForLanguage('en')).toBe('ltr');
    expect(textDirectionForLanguage('el')).toBe('ltr');
  });

  it('marks common RTL languages', () => {
    expect(textDirectionForLanguage('ar')).toBe('rtl');
    expect(textDirectionForLanguage('he-IL')).toBe('rtl');
    expect(textDirectionForLanguage('fa')).toBe('rtl');
  });
});
