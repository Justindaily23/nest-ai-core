import { BadRequestException } from '@nestjs/common';
import { QueryService } from './query.service';

describe('QueryService', () => {
  let service: QueryService;

  beforeEach(() => {
    service = new QueryService();
  });

  // ----------------------------------------------------------------
  // Validation
  // ----------------------------------------------------------------
  describe('validation', () => {
    it('throws BadRequestException when query is empty string', () => {
      expect(() =>
        service.buildPlan({ tenantId: 'tenant-1', query: '', topK: 10 }),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException when query is only whitespace', () => {
      expect(() =>
        service.buildPlan({ tenantId: 'tenant-1', query: '   ', topK: 10 }),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException when tenantId is missing', () => {
      expect(() =>
        service.buildPlan({ tenantId: '', query: 'what is RAG?', topK: 10 }),
      ).toThrow(BadRequestException);
    });

    it('trims whitespace from query before building plan', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: '  what is RAG?  ',
        topK: 10,
      });

      expect(plan.query).toBe('what is RAG?');
    });
  });

  // ----------------------------------------------------------------
  // Strategy routing
  // ----------------------------------------------------------------
  describe('strategy routing', () => {
    it('defaults to hybrid for a natural language query', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'what is retrieval augmented generation?',
        topK: 10,
      });

      expect(plan.strategy).toBe('hybrid');
    });

    it('routes JIRA-style ticket IDs to lexical-only', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'JIRA-123',
        topK: 10,
      });

      expect(plan.strategy).toBe('lexical-only');
    });

    it('routes uppercase ticket IDs with longer prefix to lexical-only', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'PROJ-9999',
        topK: 10,
      });

      expect(plan.strategy).toBe('lexical-only');
    });

    it('routes UUID to lexical-only', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        topK: 10,
      });

      expect(plan.strategy).toBe('lexical-only');
    });

    it('routes query containing a ticket ID as part of sentence to hybrid', () => {
      // Anchored regex — "containing" an ID is not the same as "being" an ID
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'JIRA-123 is blocking the release',
        topK: 10,
      });

      expect(plan.strategy).toBe('hybrid');
    });

    it('routes lowercase ticket-like pattern to hybrid (not lexical-only)', () => {
      // Regex requires uppercase prefix — lowercase should fall through
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'jira-123',
        topK: 10,
      });

      expect(plan.strategy).toBe('hybrid');
    });
  });

  // ----------------------------------------------------------------
  // topK clamping
  // ----------------------------------------------------------------
  describe('topK clamping', () => {
    it('clamps topK to MAX when value exceeds ceiling', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'valid query',
        topK: 999,
      });

      expect(plan.topK).toBe(20);
    });

    it('clamps topK to MIN when value is zero', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'valid query',
        topK: 0,
      });

      expect(plan.topK).toBe(1);
    });

    it('clamps topK to MIN when value is negative', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'valid query',
        topK: -5,
      });

      expect(plan.topK).toBe(1);
    });

    it('uses DEFAULT_TOP_K when topK is undefined', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'valid query',
        topK: undefined as any,
      });

      expect(plan.topK).toBe(10);
    });

    it('preserves topK when within valid range', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'valid query',
        topK: 15,
      });

      expect(plan.topK).toBe(15);
    });
  });

  // ----------------------------------------------------------------
  // Plan shape
  // ----------------------------------------------------------------
  describe('plan shape', () => {
    it('threads filters through to the plan unchanged', () => {
      const filters = {
        documentIds: ['doc-1', 'doc-2'],
        mimeTypes: ['application/pdf'],
      };

      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'valid query',
        topK: 10,
        filters,
      });

      expect(plan.filters).toEqual(filters);
    });

    it('carries tenantId through to the plan', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-abc',
        query: 'valid query',
        topK: 10,
      });

      expect(plan.tenantId).toBe('tenant-abc');
    });

    it('includes options on every plan', () => {
      const plan = service.buildPlan({
        tenantId: 'tenant-1',
        query: 'valid query',
        topK: 10,
      });

      expect(plan.options).toMatchObject({
        enableParentExpansion: true,
        enableRank: false,
        minimumVectorScore: 0.7,
      });
    });
  });
});
