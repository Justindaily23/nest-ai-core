import { Injectable } from '@nestjs/common';
import { CanonicalSection } from '../../canonical-document';
import { createHash } from 'crypto';

@Injectable()
export class PdfSectionBuilder {
  /**
   * Splits raw PDF text into CanonicalSections.
   *
   * Strategy: split on two or more consecutive newlines — approximates
   * paragraph/section boundaries in most business documents.
   * Not perfect for tables or multi-column layouts; those require
   * a render-callback approach and can be added as a variant codec later.
   */
  build(rawText: string, sourceId: string): CanonicalSection[] {
    const rawSections = rawText
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return rawSections.map((text, index) => ({
      sectionId: this.buildSectionId(sourceId, index),
      rawText: text,
      structuralPath: `section.${index}`,
      // pageRange omitted — pdf-parse does not give per-section page numbers
      // without a render callback. Can be added later if i consider adding pages to the citation.
    }));
  }

  /**
   * Deterministic section ID: SHA-256 of (sourceId + index).
   * Stable across re-ingestion of the same document — same document
   * always produces the same section IDs, enabling safe upserts.
   */
  private buildSectionId(sourceId: string, index: number): string {
    return createHash('sha256')
      .update(`${sourceId}:${index}`)
      .digest('hex')
      .slice(0, 32);
  }
}
