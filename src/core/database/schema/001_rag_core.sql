-- ===========================================================================
-- @file 001_rag_core.sql
-- @description PHASE 3.5: RAG Pipeline Mathematically Constrained Storage Substrate.
-- 
-- DESIGN INVARIANTS:
--   1. PostgreSQL acts as the single immutable system of record.
--   2. Text chunks are immutable; vector projections are disposable.
--   3. Strict multi-tenant isolation boundaries are enforced on every table.
-- ===========================================================================

-- 🚨 SYSTEM PRE-REQUISITE: Initialize the open-source vector mathematics extension.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- 1. DOCUMENTS TABLE: Immutable Ingestion Anchors
-- ---------------------------------------------------------------------------
-- Represents the raw file source tracker produced by ingestion codecs.
-- No embedding data is ever stored at this tier.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    -- Unique identifier using standard UUID machine codes.
    id UUID PRIMARY KEY,
    
    -- Mandatory tenant segregation anchor. Prevents customer data cross-contamination.
    tenant_id UUID NOT NULL,
    
    -- Tracks source system origins for parsing rules (e.g., 'pdf', 'docx', 'slack').
    source_type TEXT NOT NULL,
    
    -- Original filename metadata for administrative audits.
    filename TEXT,
    
    -- Internet media type designator for programmatic rendering.
    mime_type TEXT,
    
    -- SHA-256 digital signature of raw data. Enforces system-level deduplication.
    checksum TEXT NOT NULL,
    
    -- Flexible binary JSON container for codec structural markers (e.g., page maps).
    metadata JSONB,
    
    -- Immutable timezone-aware system creation marker.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES: Document Layer Optimization
-- Speeds up customer-level file inventory queries.
CREATE INDEX idx_documents_tenant ON documents (tenant_id);

-- Hard safety constraint: Blocks duplicate ingestion processing loops per tenant.
CREATE UNIQUE INDEX idx_documents_dedup ON documents (tenant_id, checksum);



