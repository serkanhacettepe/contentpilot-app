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

    console.log("[Generate] Sending request to Anthropic");

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
    console.log("[Generate] Anthropic response received", { status: response.status });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[Generate] Non-JSON response from Anthropic", rawText.slice(0, 300));
      return Response.json(
        {
          error: "Anthropic returned a non-JSON response.",
          details: rawText.slice(0, 300),
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error("[Generate] Anthropic API error", data);
      return Response.json(
        { error: data.error?.message || "Anthropic API request failed", details: data },
        { status: response.status }
      );
    }

    const text = (data.content || [])
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n\n");

    if (!text) {
      console.error("[Generate] Anthropic response missing article text", data);
      return Response.json(
        { error: "Anthropic response did not include article text." },
        { status: 502 }
      );
    }

    console.log("[Generate] Article generated successfully", {
      textLength: text.length,
    });

    return Response.json({ text });
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
