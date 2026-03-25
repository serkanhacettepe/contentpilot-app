export async function POST(request) {
  const { keyword, language, tone, wordCount } = await request.json();

  const systemPrompt = `You are ContentPilot, an expert SEO content writer. Generate a comprehensive, well-structured article optimized for the keyword provided.

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
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write a comprehensive SEO article targeting the keyword: "${keyword}"`,
        },
      ],
    }),
  });

  const data = await response.json();

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

  return Response.json({ text });
}
