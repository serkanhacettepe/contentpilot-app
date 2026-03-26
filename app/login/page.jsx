// app/login/page.jsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleGoogle() {
    setError("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/app` },
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push("/app");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setMessage("Check your email for a confirmation link.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06060f",
      color: "#eef2ff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
    }}>
      <div style={{
        width: 380,
        background: "#0a0a1a",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 40,
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40,
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            borderRadius: 10, display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, transform: "rotate(-5deg)",
            marginBottom: 12,
          }}>*</div>
          <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>ContentPilot</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </div>
        </div>

        <button
          onClick={handleGoogle}
          style={{
            width: "100%", padding: "11px 16px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0", fontSize: 14, fontWeight: 600,
            cursor: "pointer", marginBottom: 20, display: "flex",
            alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ textAlign: "center", color: "#475569", fontSize: 12, marginBottom: 20 }}>or</div>

        <form onSubmit={handleSubmit}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 8, marginBottom: 10,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 8, marginBottom: 16,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
          />

          {error && (
            <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}
          {message && (
            <div style={{ color: "#34d399", fontSize: 13, marginBottom: 12 }}>{message}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #7c3aed)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#64748b" }}>
          {mode === "signin" ? (
            <>No account?{" "}
              <button onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 13 }}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => setMode("signin")} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 13 }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
