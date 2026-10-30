import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const {
    urls = [],
    outputFormat = 'markdown',
    includeLinks = true,
    includeTables = true,
    maxTokensPerUrl = 4000,
    proxyConfiguration: customProxyConfig,
} = input;

if (!Array.isArray(urls) || urls.length === 0) {
    await Actor.exit({ exitCode: 0, statusMessage: 'No URLs provided in input.' });
}

function estimateTokenCount(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.trim().length / 4);
}

function truncateToTokenBudget(text, maxTokens) {
    if (!maxTokens || maxTokens <= 0) return { content: text, truncated: false };
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return { content: text, truncated: false };

    const slice = text.slice(0, maxChars);
    const lastSentenceEnd = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('.\n'),
        slice.lastIndexOf('\n\n'),
    );
    const safeEnd = lastSentenceEnd > maxChars * 0.7 ? lastSentenceEnd + 1 : maxChars;
    return {
        content: `${text.slice(0, safeEnd)}\n\n[... Truncated: Exceeded ${maxTokens} tokens limit ...]`,
        truncated: true,
    };
}

function htmlToMarkdown($, element, { includeLinks: keepLinks, includeTables: keepTables }) {
    $(element).find([
        'script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside',
        '.ad', '.ads', '.advertisement', '.sidebar', '.cookie-banner',
        '.newsletter-signup', '[role="navigation"]', '[role="banner"]',
        '[role="complementary"]', 'svg', 'canvas', 'iframe',
    ].join(', ')).remove();

    $(element).find('pre').each((_, pre) => {
        const codeEl = $(pre).find('code');
        const lang = (codeEl.attr('class') || '').match(/language-([a-z0-9_-]+)/i)?.[1] || '';
        const codeText = codeEl.length ? codeEl.text() : $(pre).text();
        $(pre).replaceWith(`\n\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`);
    });

    $(element).find('code').each((_, code) => {
        const t = $(code).text().trim();
        $(code).replaceWith(`\`${t}\``);
    });

    for (let h = 1; h <= 6; h++) {
        const hashes = '#'.repeat(h);
        $(element).find(`h${h}`).each((_, heading) => {
            const txt = $(heading).text().trim();
            $(heading).replaceWith(`\n\n${hashes} ${txt}\n\n`);
        });
    }

    $(element).find('blockquote').each((_, bq) => {
        const lines = $(bq).text().trim().split('\n').map((l) => `> ${l.trim()}`).join('\n');
        $(bq).replaceWith(`\n\n${lines}\n\n`);
    });

    if (keepTables) {
        $(element).find('table').each((_, tbl) => {
            const rows = [];
            $(tbl).find('tr').each((_, tr) => {
                const cols = [];
                $(tr).find('th, td').each((_, cell) => {
                    cols.push($(cell).text().trim().replace(/\|/g, '\\|').replace(/\n+/g, ' '));
                });
                if (cols.length > 0) rows.push(cols);
            });

            if (rows.length === 0) return;
            const colCount = Math.max(...rows.map((r) => r.length));
            let mdTable = '\n\n';
            const headerRow = rows[0].concat(Array(Math.max(0, colCount - rows[0].length)).fill(''));
            mdTable += `| ${headerRow.join(' | ')} |\n`;
            mdTable += `| ${Array(colCount).fill('---').join(' | ')} |\n`;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i].concat(Array(Math.max(0, colCount - rows[i].length)).fill(''));
                mdTable += `| ${row.join(' | ')} |\n`;
            }
            mdTable += '\n';
            $(tbl).replaceWith(mdTable);
        });
    } else {
        $(element).find('table').remove();
    }

    $(element).find('ul > li').each((_, li) => {
        const txt = $(li).text().trim();
        $(li).replaceWith(`\n- ${txt}`);
    });
    $(element).find('ol > li').each((i, li) => {
        const txt = $(li).text().trim();
        $(li).replaceWith(`\n${i + 1}. ${txt}`);
    });

    if (keepLinks) {
        $(element).find('a[href]').each((_, a) => {
            const href = $(a).attr('href')?.trim();
            const text = $(a).text().trim();
            if (href && text && !href.startsWith('javascript:')) {
                $(a).replaceWith(`[${text}](${href})`);
            }
        });
    }

    $(element).find('strong, b').each((_, el) => {
        $(el).replaceWith(`**${$(el).text().trim()}**`);
    });
    $(element).find('em, i').each((_, el) => {
        $(el).replaceWith(`*${$(el).text().trim()}*`);
    });

    return $(element).text()
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

let proxyConfiguration;
try {
    if (customProxyConfig?.useApifyProxy) {
        proxyConfiguration = await Actor.createProxyConfiguration(customProxyConfig);
    }
} catch (err) {
    console.warn(`[Proxy Warning] Falling back to direct connection: ${err.message}`);
}

const crawler = new CheerioCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl: urls.length,
    maxConcurrency: 10,
    requestHandlerTimeoutSecs: 30,
    async requestHandler({ $, request }) {
        const url = request.url;
        const pageTitle = $('head title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';
        const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

        const contentSelector = ['article', 'main', '[role="main"]', '.main-content', '#content', 'body']
            .find((s) => $(s).length > 0) || 'body';

        const mainElement = $(contentSelector).first();
        let extractedContent = '';

        if (outputFormat === 'cleanText') {
            mainElement.find('script, style, noscript, nav, footer').remove();
            extractedContent = mainElement.text().replace(/\s+/g, ' ').trim();
        } else if (outputFormat === 'structuredJson') {
            const sections = [];
            mainElement.find('h1, h2, h3').each((_, el) => {
                const hTag = el.tagName.toLowerCase();
                const title = $(el).text().trim();
                const content = $(el).nextUntil('h1, h2, h3').text().trim();
                sections.push({ level: hTag, title, content });
            });
            extractedContent = JSON.stringify(sections, null, 2);
        } else {
            extractedContent = htmlToMarkdown($, mainElement, { includeLinks, includeTables });
        }

        const { content: finalContent, truncated } = truncateToTokenBudget(extractedContent, maxTokensPerUrl);
        const estimatedTokens = estimateTokenCount(finalContent);

        try {
            await Actor.charge({
                eventName: 'mcp-page-extracted',
                count: 1,
            });
        } catch (chargeErr) {
            console.warn(`[Billing Note] Running outside Apify Store / PPE test mode: ${chargeErr.message}`);
        }

        await Actor.pushData({
            url,
            title: pageTitle,
            description: metaDescription,
            format: outputFormat,
            content: finalContent,
            tokenCount: estimatedTokens,
            isTruncated: truncated,
            extractedAt: new Date().toISOString(),
            status: 'success',
        });
    },
    async failedRequestHandler({ request }, error) {
        await Actor.pushData({
            url: request.url,
            status: 'failed',
            error: error.message,
            extractedAt: new Date().toISOString(),
        });
    },
});

await crawler.run(urls);
await Actor.exit();
