# MCP Universal Web Reader for AI Agents (Pay-Per-Page)

Blazing-fast, LLM-optimized web content scraper and converter built specifically for **Model Context Protocol (MCP) clients, Claude Desktop, Cursor, ChatGPT, and LangChain/LlamaIndex RAG pipelines**.

Converts raw, bloated HTML into noise-free Markdown with tables, code blocks, and token budget estimation at just **$0.004 per page**.

## Key Advantages

- **Zero Noise Extraction:** Removes cookie banners, navigation menus, ads, footers, tracking scripts, and sidebars automatically.
- **Table & Code Retention:** Preserves Markdown tables and syntax-highlighted code fences.
- **Token Budget Guardrails:** Sets hard token limits (`maxTokensPerUrl`) to prevent LLM context-window overflow and save inference costs.
- **Native MCP Compatible:** Can be invoked directly as an Apify Tool inside Claude Desktop and Cursor via `mcp.apify.com`.
