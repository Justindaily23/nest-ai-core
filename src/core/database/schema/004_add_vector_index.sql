-- ---------------------------------------------------------------------------
--  VECTOR LAYER ACCELERATION: IVFFlat Clustering Optimization
-- ---------------------------------------------------------------------------
-- This migration isolates the mathematical vector index creation layer. 
--
-- DESIGN DECISIONS:
-- 1. Run Deferral: Building IVFFlat maps on 0 rows causes empty, unoptimized 
--    clusters. Execute this migration script ONLY after the database has 
--    accumulated a baseline threshold of vector embeddings (recommended: 5,000+ rows).
-- 2. Concurrency: Uses CONCURRENTLY to build the index maps quietly in the 
--    background. This ensures our core live tables remain unlocked, allowing 
--    users to seamlessly query or insert files without application timeouts.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_vector 
ON chunk_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
