import { describe, it, expect } from 'vitest';
import { mask, maskAll } from '../../../src/lexi-dashboard/services/credential-store.js';

describe('credential masking', () => {
  it('masks long secrets as first2***last4', () => {
    expect(mask('sk-prod-abcdef1234')).toBe('sk***1234');
    expect(mask('abcdef1234')).toBe('ab***1234');
  });
  it('masks short secrets as ***', () => {
    expect(mask('abc')).toBe('***');
    expect(mask('abcde')).toBe('***');
  });
  it('returns null for empty/null/undefined', () => {
    expect(mask('')).toBeNull();
    expect(mask(null)).toBeNull();
    expect(mask(undefined)).toBeNull();
  });
  it('maskAll preserves keys, masks every value', () => {
    const out = maskAll({ API_KEY: 'sk-prod-abcdef1234', EMPTY: '', NICK: 'kade' });
    expect(out).toEqual({ API_KEY: 'sk***1234', EMPTY: null, NICK: '***' });
  });
  it('mask never returns the raw value', () => {
    const raw = 'sk-prod-supersecretvalue-9999';
    const out = mask(raw);
    expect(out).not.toBe(raw);
    expect(out).not.toContain('supersecret');
  });
});
