// tiktoken.tokenizer.spec.ts

import { TiktokenTokenizer } from './tiktoken.tokenizer';

describe('TiktokenTokenizer', () => {
  let tokenizer: TiktokenTokenizer;

  beforeEach(() => {
    tokenizer = new TiktokenTokenizer();
  });

  afterEach(() => {
    // Explicitly free WASM memory after each test — mirrors beforeApplicationShutdown
    tokenizer.beforeApplicationShutdown();
  });

  // ----------------------------------------------------------------
  // encode
  // ----------------------------------------------------------------
  describe('encode', () => {
    it('returns a non-empty array for a normal string', () => {
      const tokens = tokenizer.encode('hello world');

      expect(tokens.length).toBeGreaterThan(0);
    });

    it('returns a standard JS array, not a Uint32Array', () => {
      const tokens = tokenizer.encode('hello world');

      expect(Array.isArray(tokens)).toBe(true);
    });

    it('returns empty array for empty string', () => {
      const tokens = tokenizer.encode('');

      expect(tokens).toEqual([]);
    });

    it('returns number array where every element is a non-negative integer', () => {
      const tokens = tokenizer.encode(
        'what is retrieval augmented generation?',
      );

      tokens.forEach((t) => {
        expect(typeof t).toBe('number');
        expect(t).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(t)).toBe(true);
      });
    });

    it('produces more tokens for longer text', () => {
      const short = tokenizer.encode('hello');
      const long = tokenizer.encode('hello world this is a longer sentence');

      expect(long.length).toBeGreaterThan(short.length);
    });
  });

  // ----------------------------------------------------------------
  // decode
  // ----------------------------------------------------------------
  describe('decode', () => {
    it('round-trips ASCII text through encode then decode', () => {
      const original = 'hello world';
      const tokens = tokenizer.encode(original);
      const decoded = tokenizer.decode(tokens);

      expect(decoded).toBe(original);
    });

    it('round-trips text with punctuation and numbers', () => {
      const original = 'RAG pipeline v2.0 — what is it?';
      const tokens = tokenizer.encode(original);
      const decoded = tokenizer.decode(tokens);

      expect(decoded).toBe(original);
    });

    it('handles multi-byte characters without corruption', () => {
      const original = 'こんにちは'; // Japanese — multi-byte
      const tokens = tokenizer.encode(original);
      const decoded = tokenizer.decode(tokens);

      expect(decoded).toBe(original);
    });

    it('handles emoji without corruption', () => {
      const original = 'hello 🌍';
      const tokens = tokenizer.encode(original);
      const decoded = tokenizer.decode(tokens);

      expect(decoded).toBe(original);
    });

    it('returns empty string for empty token array', () => {
      const decoded = tokenizer.decode([]);

      expect(decoded).toBe('');
    });
  });

  // ----------------------------------------------------------------
  // count
  // ----------------------------------------------------------------
  describe('count', () => {
    it('returns a positive integer for normal text', () => {
      const count = tokenizer.count('hello world');

      expect(count).toBeGreaterThan(0);
      expect(Number.isInteger(count)).toBe(true);
    });

    it('returns zero for empty string', () => {
      const count = tokenizer.count('');

      expect(count).toBe(0);
    });

    it('count matches encode length for the same input', () => {
      const text = 'what is retrieval augmented generation?';

      expect(tokenizer.count(text)).toBe(tokenizer.encode(text).length);
    });

    it('produces higher count for longer text', () => {
      const short = tokenizer.count('hello');
      const long = tokenizer.count('hello world this is a longer sentence');

      expect(long).toBeGreaterThan(short);
    });
  });

  // ----------------------------------------------------------------
  // WASM lifecycle
  // ----------------------------------------------------------------
  describe('lifecycle', () => {
    it('can be instantiated without throwing', () => {
      expect(() => new TiktokenTokenizer()).not.toThrow();
    });

    it('beforeApplicationShutdown frees encoder without throwing', () => {
      const instance = new TiktokenTokenizer();

      expect(() => instance.beforeApplicationShutdown()).not.toThrow();
    });
  });
});
