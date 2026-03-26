// app/api/generate/route.js
import { createClient } from "@/lib/supabase-server";
import { getPlanLimit } from "@/lib/plans";

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
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { keyword, language, tone, wordCount } = await request.json();

    console.log("[Generate] Request received", {
      keyword,
      language,
      tone,
      wordCount,
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      userId: user.id,
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY is missing on the server." }, { status: 500 });
    }

    if (!keyword?.trim()) {
      return Response.json({ error: "Keyword is required." }, { status: 400 });
    }

    // Fetch profile and check usage limit
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, articles_used_this_month, reset_date")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: "User profile not found." }, { status: 500 });
    }

    // Monthly reset check
    if (new Date() > new Date(profile.reset_date)) {
      await supabase
        .from("profiles")
        .update({
          articles_used_this_month: 0,
          reset_date: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString(); })(),
        })
        .eq("id", user.id);
      profile.articles_used_this_month = 0;
    }

    const limit = getPlanLimit(profile.plan);
    if (profile.articles_used_this_month >= limit) {
      return Response.json(
        {
          error: `You've used all ${limit} articles for this month. Upgrade your plan to continue.`,
          limitReached: true,
        },
        { status: 403 }
      );
    }

    // Call Anthropic with streaming
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let anthropicResponse;
    try {
      anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
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
      if (error?.name === "AbortError") {
        return Response.json({ error: "Request timed out. Please try again." }, { status: 504 });
      }
      return Response.json({ error: error?.message || "Anthropic request failed." }, { status: 502 });
    }

    clearTimeout(timeoutId);

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      let errData = {};
      try { errData = JSON.parse(errText); } catch {}
      return Response.json(
        { error: errData.error?.message || "Anthropic API error" },
        { status: anthropicResponse.status }
      );
    }

    // Stream and accumulate
    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
                  fullText += chunk;
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("[Generate] Stream error", err);
        } finally {
          // Save article and increment counter after streaming
          if (fullText.trim()) {
            const lines = fullText.split("\n");
            const title = lines[0]?.startsWith("# ") ? lines[0].replace(/^#\s+/, "") : keyword;
            const body = lines[0]?.startsWith("# ") ? lines.slice(1).join("\n").trim() : fullText;
            const wordCountActual = body.trim().split(/\s+/).length;

            await supabase.from("articles").insert({
              user_id: user.id,
              title,
              content: body,
              keyword,
              language,
              tone,
              word_count: wordCountActual,
              seo_score: 0,
            });

            // Atomic increment to avoid race conditions
            await supabase.rpc("increment_article_count", { user_id: user.id });

            console.log("[Generate] Article saved", { title, wordCount: wordCountActual });
          }

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
      { error: error?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
