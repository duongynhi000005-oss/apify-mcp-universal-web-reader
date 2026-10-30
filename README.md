# AI Agent, MCP & RAG Website-to-Markdown Semantic Chunker

Converts any webpage or documentation page into clean GitHub-Flavored Markdown (preserving tables, code blocks, and heading hierarchy) + token-counted RAG semantic chunks with configurable overlap for LLMs, LangChain, LlamaIndex, and MCP servers.

## Why Use AI Agent, MCP & RAG Website-to-Markdown Semantic Chunker?
- **Production-Grade & Zero Maintenance**: Built specifically for automated workflows in **n8n, Make.com, Zapier, Clay, LangChain, and MCP servers**.
- **Pay-Per-Event (PPE) Transparent Pricing**: Only **$0.002 per enriched result** (`$2.00 per 1,000 results`) with structured JSON, CSV, and Excel export.
- **Fast & Lightweight**: Uses high-concurrency HTTP parsing and structured JSON-LD / API discovery without expensive headless browser overhead.

## Key Features
1. **Deep Structured Extraction**: Automatically normalizes every output record against a strict dataset schema.
2. **Plug-and-Play API & Webhook Integration**: Call directly via `POST https://api.apify.com/v2/acts/huynguyen-data-cloud~mcp-universal-web-reader/run-sync-get-dataset-items`.
3. **Built-in Data Hygiene**: Deduplicates records, filters false positives, and computes actionable scoring metrics.

## Quick Start (cURL / API)
```bash
curl -X POST "https://api.apify.com/v2/acts/huynguyen-data-cloud~mcp-universal-web-reader/run-sync-get-dataset-items?token=YOUR_APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startUrls": [{"url": "https://apify.com"}], "chunkSizeTokens": 500, "chunkOverlapTokens": 60}'
```
