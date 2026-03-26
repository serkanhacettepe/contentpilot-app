"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const LANGUAGES = [
  { code: "en", label: "English", flag: "GB" },
  { code: "tr", label: "Turkce", flag: "TR" },
  { code: "es", label: "Espanol", flag: "ES" },
  { code: "de", label: "Deutsch", flag: "DE" },
  { code: "fr", label: "Francais", flag: "FR" },
  { code: "ar", label: "Arabic", flag: "SA" },
  { code: "pt", label: "Portugues", flag: "BR" },
  { code: "ja", label: "Japanese", flag: "JP" },
];

const TONES = ["Professional", "Casual", "Authoritative", "Friendly", "Academic"];

const LENGTHS = [
  { label: "Short (~800 words)", value: 800 },
  { label: "Medium (~1500 words)", value: 1500 },
  { label: "Long (~2500 words)", value: 2500 },
];

function calculateSEOScore(content, keyword) {
  if (!content || !keyword) return { total: 0, breakdown: {}, stats: {} };

  const lower = content.toLowerCase();
  const kw = keyword.toLowerCase();
  const words = content.trim().split(/\s+/).length;
  const safeKw = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const kwCount = (lower.match(new RegExp(safeKw, "g")) || []).length;
  const density = words > 0 ? (kwCount / words) * 100 : 0;
  const hasH2 = /##\s/.test(content);
  const hasH3 = /###\s/.test(content);
  const headingCount = (content.match(/^#{2,3}\s/gm) || []).length;
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 20);
  const sentenceEndings = (content.match(/[.!?]\s/g) || []).length;
  const avgSentenceLen = sentenceEndings > 0 ? words / sentenceEndings : words;

  const kwScore = Math.min(
    25,
    density >= 0.8 && density <= 2.5
      ? 25
      : density < 0.8
        ? density * 20
        : Math.max(0, 25 - (density - 2.5) * 10)
  );
  const structScore = Math.min(25, (hasH2 ? 8 : 0) + (hasH3 ? 7 : 0) + Math.min(10, headingCount * 2.5));
  const readScore = Math.min(25, (avgSentenceLen < 25 ? 12 : 6) + (paragraphs.length > 4 ? 7 : 3) + (paragraphs.length > 1 ? 6 : 0));
  const lenScore = Math.min(25, words >= 800 ? 25 : (words / 800) * 25);
  const total = Math.round(kwScore + structScore + readScore + lenScore);

  return {
    total: Math.min(100, total),
    breakdown: {
      keyword: Math.round(kwScore),
      structure: Math.round(structScore),
      readability: Math.round(readScore),
      length: Math.round(lenScore),
    },
    stats: {
      words,
      kwCount,
      density: density.toFixed(1),
      headingCount,
      paragraphs: paragraphs.length,
    },
  };
}

function generateWordPressHTML(title, content, keyword) {
  const htmlContent = content
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .split("\n\n")
    .map((block) => {
      if (/^<h[1-3]>/.test(block)) return block;
      return `<p>${block}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<meta name="keywords" content="${keyword}">
<meta name="description" content="${title}">
</head>
<body>
<article>
<h1>${title}</h1>
${htmlContent}
</article>
</body>
</html>`;
}

function ScoreBar({ label, score, max = 25, color }) {
  const pct = (score / max) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#a5b4cf", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "#fff", fontWeight: 700 }}>
          {score}/{max}
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: 3,
            transition: "width 0.6s ease-out",
          }}
        />
      </div>
    </div>
  );
}

export default function ContentPilotApp() {
  const [keyword, setKeyword] = useState("");
  const [language, setLanguage] = useState("en");
  const [tone, setTone] = useState("Professional");
  const [wordCount, setWordCount] = useState(1500);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [seoScore, setSeoScore] = useState(null);
  const [activeTab, setActiveTab] = useState("editor");
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const [loadingPhase, setLoadingPhase] = useState(0);
  const contentRef = useRef(null);

  const langLabel = LANGUAGES.find((l) => l.code === language)?.label || "English";

  useEffect(() => {
    if (generatedContent && keyword) {
      setSeoScore(calculateSEOScore(generatedContent, keyword));
    }
  }, [generatedContent, keyword]);

  const generateArticle = useCallback(async () => {
    if (!keyword.trim()) {
      setError("Please enter a target keyword.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setGeneratedContent("");
    setGeneratedTitle("");
    setStreamText("");
    setSeoScore(null);
    setActiveTab("editor");
    setLoadingPhase(0);

    const phaseInterval = setInterval(() => {
      setLoadingPhase((p) => (p < 3 ? p + 1 : p));
    }, 1500);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, language: langLabel, tone, wordCount }),
      });

      clearInterval(phaseInterval);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response. Check the deployment logs.");
      }

      const data = await response.json();
      const fullText = data.text || "";

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate article.");
      }

      if (!fullText) {
        throw new Error(data.error || "Claude response did not include article text.");
      }

      const lines = fullText.split("\n");
      let title = keyword;
      let body = fullText;

      if (lines[0]?.startsWith("# ")) {
        title = lines[0].replace(/^#\s+/, "");
        body = lines.slice(1).join("\n").trim();
      }

      setGeneratedTitle(title);

      let i = 0;
      const typeInterval = setInterval(() => {
        i += 2;
        if (i >= body.length) {
          setStreamText(body);
          setGeneratedContent(body);
          setIsGenerating(false);
          clearInterval(typeInterval);
        } else {
          setStreamText(body.slice(0, i));
        }
      }, 8);
    } catch (err) {
      clearInterval(phaseInterval);
      setError(`Generation failed: ${err.message}`);
      setIsGenerating(false);
    }
  }, [keyword, langLabel, tone, wordCount]);

  const copyToClipboard = (text, format) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(format);
      setTimeout(() => setCopySuccess(""), 2000);
    });
  };

  const exportWordPress = () => {
    const html = generateWordPressHTML(generatedTitle || keyword, generatedContent, keyword);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${keyword.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setCopySuccess("wp");
    setTimeout(() => setCopySuccess(""), 2500);
  };

  const displayContent = generatedContent || streamText;
  const loadingMessages = [
    "Analyzing SERP data...",
    "Scanning top 10 competitors...",
    "Extracting semantic keywords...",
    "Generating optimized content...",
  ];

  const scoreColor = seoScore
    ? seoScore.total >= 80
      ? "#34d399"
      : seoScore.total >= 60
        ? "#fbbf24"
        : "#f87171"
    : "#64748b";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#06060f",
        color: "#eef2ff",
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(6,6,15,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #6366f1, #22d3ee)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              transform: "rotate(-5deg)",
            }}
          >
            *
          </div>
          <span style={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: -0.5 }}>ContentPilot</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: "rgba(99,102,241,0.2)",
              color: "#818cf8",
              padding: "2px 8px",
              borderRadius: 20,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            MVP
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["editor", "score", "export"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: activeTab === tab ? "#6366f1" : "rgba(255,255,255,0.08)",
                background: activeTab === tab ? "rgba(99,102,241,0.15)" : "transparent",
                color: activeTab === tab ? "#a5b4fc" : "#64748b",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {tab === "editor" ? "Editor" : tab === "score" ? "SEO Score" : "Export"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
        <div
          style={{
            width: 320,
            minWidth: 320,
            background: "#0a0a1a",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            padding: 24,
            overflowY: "auto",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>
              Target Keyword *
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. best AI writing tools"
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                color: "#fff",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>
              Language
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid",
                    borderColor: language === lang.code ? "#6366f1" : "rgba(255,255,255,0.06)",
                    background: language === lang.code ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                    color: language === lang.code ? "#a5b4fc" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {lang.flag} {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>
              Tone
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor: tone === t ? "#6366f1" : "rgba(255,255,255,0.06)",
                    background: tone === t ? "rgba(99,102,241,0.12)" : "transparent",
                    color: tone === t ? "#a5b4fc" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>
              Article Length
            </label>
            {LENGTHS.map((l) => (
              <button
                key={l.value}
                onClick={() => setWordCount(l.value)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: wordCount === l.value ? "#6366f1" : "rgba(255,255,255,0.06)",
                  background: wordCount === l.value ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                  color: wordCount === l.value ? "#a5b4fc" : "#94a3b8",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            onClick={generateArticle}
            disabled={isGenerating}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background: isGenerating ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #7c3aed)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: isGenerating ? "not-allowed" : "pointer",
              boxShadow: isGenerating ? "none" : "0 4px 20px rgba(99,102,241,0.3)",
              letterSpacing: 0.3,
            }}
          >
            {isGenerating ? "Generating..." : "Generate Article"}
          </button>

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 8,
                fontSize: 12,
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
          {isGenerating && !streamText && (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  border: "3px solid rgba(255,255,255,0.08)",
                  borderTopColor: "#6366f1",
                  borderRadius: "50%",
                  margin: "0 auto 24px",
                  animation: "spin 1s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {loadingMessages[loadingPhase]}
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Keyword: "{keyword}" - {langLabel} - {tone}
              </div>
            </div>
          )}

          {activeTab === "editor" && !isGenerating && !displayContent && (
            <div style={{ textAlign: "center", padding: "100px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>*</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#94a3b8" }}>
                Ready to create SEO content
              </div>
              <div style={{ fontSize: 14, color: "#475569", maxWidth: 400, margin: "0 auto" }}>
                Enter your target keyword in the sidebar and click Generate Article to start.
              </div>
            </div>
          )}

          {activeTab === "editor" && displayContent && (
            <div>
              {generatedTitle && (
                <h1
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 800,
                    letterSpacing: -0.5,
                    marginBottom: 8,
                    lineHeight: 1.2,
                    background: "linear-gradient(135deg, #fff, #a5b4cf)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {generatedTitle}
                </h1>
              )}

              {seoScore && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 14px",
                    background: `${scoreColor}15`,
                    border: `1px solid ${scoreColor}40`,
                    borderRadius: 8,
                    marginBottom: 24,
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: scoreColor }}>
                    {seoScore.total}
                  </span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>SEO Score</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>-</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{seoScore.stats?.words || 0} words</span>
                </div>
              )}

              <div
                ref={contentRef}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: 32,
                  fontSize: 15,
                  lineHeight: 1.85,
                  color: "#cbd5e1",
                  whiteSpace: "pre-wrap",
                  fontFamily: "Georgia, Times New Roman, serif",
                }}
              >
                {displayContent.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return (
                      <h2 key={i} style={{ fontSize: "1.3rem", fontWeight: 700, color: "#e2e8f0", margin: "28px 0 12px" }}>
                        {line.replace(/^##\s/, "")}
                      </h2>
                    );
                  }

                  if (line.startsWith("### ")) {
                    return (
                      <h3 key={i} style={{ fontSize: "1.1rem", fontWeight: 600, color: "#94a3b8", margin: "20px 0 8px" }}>
                        {line.replace(/^###\s/, "")}
                      </h3>
                    );
                  }

                  if (line.trim() === "") return <br key={i} />;

                  const parts = line.split(/(\*\*[^*]+\*\*)/g);

                  return (
                    <p key={i} style={{ marginBottom: 12 }}>
                      {parts.map((part, j) =>
                        part.startsWith("**") && part.endsWith("**") ? (
                          <strong key={j} style={{ color: "#e2e8f0", fontWeight: 700 }}>
                            {part.slice(2, -2)}
                          </strong>
                        ) : (
                          <span key={j}>{part}</span>
                        )
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "score" && (
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 24 }}>SEO Analysis</h2>
              {!seoScore ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  Generate an article first to see the SEO analysis.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16,
                      padding: 28,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        border: `4px solid ${scoreColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                        background: `${scoreColor}10`,
                      }}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: 40, fontWeight: 900, color: scoreColor }}>
                        {seoScore.total}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Overall SEO Score</div>
                  </div>

                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16,
                      padding: 28,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Score Breakdown</div>
                    <ScoreBar label="Keyword Usage" score={seoScore.breakdown.keyword} color="#6366f1" />
                    <ScoreBar label="Content Structure" score={seoScore.breakdown.structure} color="#22d3ee" />
                    <ScoreBar label="Readability" score={seoScore.breakdown.readability} color="#34d399" />
                    <ScoreBar label="Content Length" score={seoScore.breakdown.length} color="#f59e0b" />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "export" && (
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 24 }}>Export and Publish</h2>
              {!generatedContent ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  Generate an article first to export it.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <button
                    onClick={() => copyToClipboard(generatedContent, "md")}
                    style={{
                      padding: 28,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${copySuccess === "md" ? "#34d399" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 16,
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 12 }}>Copy</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                      {copySuccess === "md" ? "Copied" : "Copy as Markdown"}
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      const plain = generatedContent.replace(/#{1,3}\s/g, "").replace(/\*\*/g, "");
                      copyToClipboard(plain, "txt");
                    }}
                    style={{
                      padding: 28,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${copySuccess === "txt" ? "#34d399" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 16,
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 12 }}>Text</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                      {copySuccess === "txt" ? "Copied" : "Copy as Plain Text"}
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      const html = generateWordPressHTML(generatedTitle || keyword, generatedContent, keyword);
                      copyToClipboard(html, "html");
                    }}
                    style={{
                      padding: 28,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${copySuccess === "html" ? "#34d399" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 16,
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 12 }}>HTML</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                      {copySuccess === "html" ? "Copied" : "Copy as HTML"}
                    </div>
                  </button>

                  <button
                    onClick={exportWordPress}
                    style={{
                      padding: 28,
                      background: copySuccess === "wp" ? "rgba(52,211,153,0.08)" : "rgba(99,102,241,0.08)",
                      border: `1px solid ${copySuccess === "wp" ? "#34d399" : "rgba(99,102,241,0.3)"}`,
                      borderRadius: 16,
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 12 }}>Download</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                      {copySuccess === "wp" ? "Downloaded" : "Download WordPress HTML"}
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
