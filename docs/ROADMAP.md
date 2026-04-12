# Roadmap

## Current

- Lexical packaged retrieval/search across five source types
- Local semantic search with ONNX `bge-m3`
- Hybrid search via RRF
- Tax Answer crawler
- e-Gov law retrieval/search

## Next

- Release and publish production-grade vector assets for all packaged sources
- Add richer semantic diagnostics to MCP textual responses when fallback occurs
- Expand packaged datasets and refresh cadence tooling
- Evaluate ANN backends if local corpus size outgrows in-memory scan

## Deferred

- `EMBEDDING_BACKEND=supabase` full implementation
- Server-side vector refresh automation in CI
- Cross-source semantic reranking beyond source-constrained `search_*`
