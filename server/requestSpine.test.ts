import { describe, expect, it } from 'vitest';
import { extractAgentUserTexts, validateObject } from './requestSpine';
import { HttpError } from './security';

describe('requestSpine contracts', () => {
  it('validates required fields and enums', () => {
    const body = validateObject(
      { topicLabel: 'Chem', durationMin: 25, flexibility: 'any_study' },
      {
        topicLabel: { type: 'string', required: true, maxLength: 120 },
        durationMin: { type: 'number', required: true, enum: [15, 20, 25, 30] },
        flexibility: { type: 'string', enum: ['prefer_topic', 'any_study'] },
      },
    );
    expect(body.durationMin).toBe(25);
    expect(() =>
      validateObject(
        { topicLabel: 'x' },
        { durationMin: { type: 'number', required: true } },
      ),
    ).toThrow(HttpError);
  });

  it('extracts user texts from agent message payloads', () => {
    const texts = extractAgentUserTexts([
      { role: 'model', parts: [{ text: 'hi' }] },
      { role: 'user', parts: [{ text: 'Explain osmosis' }] },
      { role: 'user', text: 'And give an example' },
    ]);
    expect(texts).toEqual(['Explain osmosis', 'And give an example']);
  });
});
