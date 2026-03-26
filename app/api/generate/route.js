function buildPrompt({ keyword, language, tone, wordCount }) {
  return `You are ContentPilot, an expert SEO content writer. Generate a comprehensive, well-structured article optimized for the keyword provided.

RULES:
- Write in ${language} language
- Use a ${tone.toLowerCase()} tone
- Target approximately ${wordCount} words
- Use markdown formatting with ## for H2 and ### for H3 headings
- Include the target keyword naturally throughout (1-2% density)
- Start with a compelling introduction
- Use 4-6 H2 sections with descriptive headings
- Include H3 subheadings within sections
- Use bold for key terms
- End with a strong conclusion
- Write unique, original, human-sounding content
- Optimize for both Google SEO and AI search engines
FIRST LINE: Output ONLY the article title on the first line, prefixed with "# "
Then write the full article.`;
}

export async function POST(request) {
  try {
    const { keyword, language, tone, wordCount } = await request.json();

    console.log("[Generate] Request received", {
      keyword,
      language,
      tone,
      wordCount,
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[Generate] Missing ANTHROPIC_API_KEY");
      return Response.json(
        { error: "ANTHROPIC_API_KEY is missing on the server." },
        { status: 500 }
      );
    }

    if (!keyword?.trim()) {
      console.error("[Generate] Missing keyword");
      return Response.json({ error: "Keyword is required." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    console.log("[Generate] Sending streaming request to Anthropic");

    let response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          stream: true,
          system: buildPrompt({ keyword, language, tone, wordCount }),
          messages: [
            {
              role: "user",
              content: `Write a comprehensive SEO article targeting the keyword: "${keyword}"`,
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("[Generate] Anthropic fetch failed", error);

      if (error instanceof Error && error.name === "AbortError") {
        return Response.json(
          { error: "Anthropic request timed out. Please try again." },
          { status: 504 }
        );
      }

      return Response.json(
        {
          error: error instanceof Error ? error.message : "Anthropic request failed.",
        },
        { status: 502 }
      );
    }

    clearTimeout(timeoutId);
    console.log("[Generate] Anthropic stream started", { status: response.status });

    if (!response.ok) {
      const errText = await response.text();
      let errData = {};
      try { errData = JSON.parse(errText); } catch {}
      console.error("[Generate] Anthropic API error", errData);
      return Response.json(
        { error: errData.error?.message || "Anthropic API request failed" },
        { status: response.status }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let charCount = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.type === "text_delta"
                ) {
                  const chunk = parsed.delta.text;
                  charCount += chunk.length;
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("[Generate] Stream read error", err);
        } finally {
          console.log("[Generate] Stream complete", { charCount });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[Generate] Route failed", error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
