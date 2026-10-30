import { Actor } from 'apify';
import * as cheerio from 'cheerio';

await Actor.init();

const input = (await Actor.getInput()) || {};
const startUrls = Array.isArray(input.startUrls) && input.startUrls.length > 0
    ? input.startUrls
    : [{ url: 'https://apify.com' }];
const chunkSizeTokens = Number(input.chunkSizeTokens ?? 500);
const chunkOverlapTokens = Number(input.chunkOverlapTokens ?? 60);

function htmlToStructuredMarkdown($) {
    $('script, style, noscript, iframe, svg, nav, footer, header, [role="navigation"], [class*="cookie"], [id*="cookie"]').remove();
    const lines = [];
    $('h1, h2, h3, h4, p, pre, li, table').each((_, el) => {
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'h1') lines.push(`\n# ${$(el).text().trim()}\n`);
        else if (tag === 'h2') lines.push(`\n## ${$(el).text().trim()}\n`);
        else if (tag === 'h3') lines.push(`\n### ${$(el).text().trim()}\n`);
        else if (tag === 'h4') lines.push(`\n#### ${$(el).text().trim()}\n`);
        else if (tag === 'pre') {
            const code = $(el).text().trim();
            if (code) lines.push(`\n\`\`\`\n${code}\n\`\`\`\n`);
        } else if (tag === 'li') {
            const txt = $(el).text().replace(/\s+/g, ' ').trim();
            if (txt) lines.push(`- ${txt}`);
        } else if (tag === 'table') {
            const rows = [];
            $(el).find('tr').each((rIdx, tr) => {
                const cols = [];
                $(tr).find('th, td').each((__, cell) => cols.push($(cell).text().replace(/\s+/g, ' ').trim()));
                if (cols.length) {
                    rows.push(`| ${cols.join(' | ')} |`);
                    if (rIdx === 0) rows.push(`| ${cols.map(() => '---').join(' | ')} |`);
                }
            });
            if (rows.length) lines.push('\n' + rows.join('\n') + '\n');
        } else {
            const txt = $(el).text().replace(/\s+/g, ' ').trim();
            if (txt.length > 15) lines.push(txt);
        }
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildSemanticChunks(markdown, maxTokens, overlapTokens) {
    const words = markdown.split(/\s+/).filter(Boolean);
    const wordsPerChunk = Math.max(50, Math.floor(maxTokens * 0.75));
    const overlapWords = Math.max(0, Math.min(wordsPerChunk - 10, Math.floor(overlapTokens * 0.75)));
    const chunks = [];
    for (let i = 0; i < words.length; i += (wordsPerChunk - overlapWords)) {
        const slice = words.slice(i, i + wordsPerChunk);
        if (!slice.length) break;
        const text = slice.join(' ');
        chunks.push({
            chunkIndex: chunks.length,
            estimatedTokens: Math.ceil(slice.length * 1.33),
            text
        });
        if (i + wordsPerChunk >= words.length) break;
    }
    return chunks;
}

for (const item of startUrls) {
    const rawUrl = typeof item === 'string' ? item : item?.url;
    if (!rawUrl) continue;
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MCP-Universal-RAG-Reader/2.0)' }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const title = $('title').first().text().trim() || url;
        const description = $('meta[name="description"]').attr('content') || '';
        const headings = [];
        $('h1, h2, h3').each((_, h) => {
            const t = $(h).text().replace(/\s+/g, ' ').trim();
            if (t) headings.push({ level: h.tagName.toLowerCase(), text: t });
        });

        const markdown = htmlToStructuredMarkdown($);
        const wordCount = markdown.split(/\s+/).filter(Boolean).length;
        const estimatedTokens = Math.ceil(wordCount * 1.33);
        const ragChunks = buildSemanticChunks(markdown, chunkSizeTokens, chunkOverlapTokens);

        await Actor.pushData({
            url,
            title,
            description,
            wordCount,
            estimatedTokens,
            chunksCount: ragChunks.length,
            headings: headings.slice(0, 40),
            markdown: markdown.slice(0, 35000),
            ragChunks: ragChunks.slice(0, 50),
            scrapedAt: new Date().toISOString()
        });
    } catch (err) {
        await Actor.pushData({ url, error: err.message, scrapedAt: new Date().toISOString() });
    }
}

await Actor.exit();
