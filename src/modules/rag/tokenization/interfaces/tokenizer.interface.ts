/**
 * @file tokenizer.interface.ts
 * @description SYSTEM INFRASTRUCTURE INTERFACE: The core token-counting contract.
 *
 * DESIGN PRINCIPLE:
 * Large Language Models and embedding endpoints do not calculate memory limits by character or word
 * count; they operate entirely on "tokens" (chunks of characters). To manage hard tenant usage caps,
 * run exact chunking loops, and prevent API rate-limit crashes, our system must count tokens locally
 * and deterministically before hitting any cloud endpoints.
 *
 * DECOUPLING PRINCIPLE:
 * This interface isolates the exact tokenizer encoding library from the core business logic.
 */

export interface Tokenizer {
  /**
   * @param text Translates a raw string payload into an array of mathematical token integers
   */
  encode(text: string): number[];

  /**
   *
   * @param tokens Translates an array of token integers back to human-readable texts
   */
  decode(tokens: number[]): string;

  /**
   *
   * @param text Hig-velocity convenience method. Calculates the numeric token weight of a string
   * withoutallocating memory for a full array payload
   * must be optimized for zero memory leakage
   */
  count(text: string): number;
}
