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

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY is missing on the server." },
        { status: 500 }
      );
    }

    if (!keyword?.trim()) {
      return Response.json({ error: "Keyword is required." }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return Response.json(
        {
          error: "Anthropic returned a non-JSON response.",
          details: rawText.slice(0, 300),
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
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
      return Response.json(
        { error: "Anthropic response did not include article text." },
        { status: 502 }
      );
    }

    return Response.json({ text });
  } catch (error) {
    console.error("Generate route failed:", error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
