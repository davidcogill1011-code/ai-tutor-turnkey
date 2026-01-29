export const runtime = "nodejs";

function buildTutorPrompt({
  subject,
  level,
  style,
  accessibility,
  learningProfile,
  mode,
  attempts,
  history,
  studentMessage
}) {
  const a = accessibility || {};
  const p = learningProfile || {};
  const isSession = mode === "session";

  const flags = {
    adhd: !!p.adhd,
    dyslexia: !!p.dyslexia,
    dyscalculia: !!p.dyscalculia,
    autism: !!p.autism,
    anxiety: !!p.anxiety,
    ell: !!p.ell
  };

  const transcript = Array.isArray(history) && history.length
    ? history.slice(-16).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n")
    : "(none)";

  return `
You are "Daily Life Tutor", an AI tutor that TEACHES and does NOT simply solve.
Primary goal: help the learner understand and become independent.

Context:
- Subject: ${subject || "General"}
- Level: ${level || "Unknown"}
- Preferred style: ${style || "Socratic + step-by-step"}
- Mode: ${isSession ? "SESSION (one micro-step at a time)" : "NORMAL"}
- Attempts so far: ${attempts || 0}

Accessibility UI toggles:
- Dyslexia-friendly: ${a.dyslexiaMode ? "ON" : "OFF"}
- Plain language: ${a.plainLanguage ? "ON" : "OFF"}
- Focus mode: ${a.focusMode ? "ON" : "OFF"}

Learning profile:
- ADHD/focus support: ${flags.adhd ? "YES" : "NO"}
- Dyslexia support: ${flags.dyslexia ? "YES" : "NO"}
- Dyscalculia support: ${flags.dyscalculia ? "YES" : "NO"}
- Autism-friendly: ${flags.autism ? "YES" : "NO"}
- Anxiety-sensitive: ${flags.anxiety ? "YES" : "NO"}
- English learner (ELL): ${flags.ell ? "YES" : "NO"}

Non-negotiable rules:
1) Do NOT provide the final answer immediately.
2) Prefer guiding questions + tiny hints.
3) If asked for the final answer:
   - only provide it if attempts >= 3, otherwise require one more attempt.
4) Use supportive tone. No shaming language.

OUTPUT FORMAT:
If Mode = NORMAL:
## Goal
## Step 1 (Your turn)
## Hint
## Similar Example
## Check Understanding

If Mode = SESSION (must be very short, EXACTLY):
## Feedback
(✅ or ❌ + 1–2 short lines)

## Next step
(one instruction/question only)

Conversation so far:
${transcript}

Student message:
"""${studentMessage}"""
`;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      subject,
      level,
      style,
      accessibility,
      learningProfile,
      mode = "normal",
      history = [],
      message,
      attempts = 0
    } = body || {};

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Missing message" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({
        reply:
`## Feedback
✅ Demo mode is on (no API key set).

## Next step
Tell me what you tried so far (one short sentence).`
      });
    }

    const prompt = buildTutorPrompt({
      subject,
      level,
      style,
      accessibility,
      learningProfile,
      mode,
      attempts,
      history,
      studentMessage: message
    });

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return Response.json(
        { error: "OpenAI error", details: data },
        { status: 500 }
      );
    }

    return Response.json({ reply: data.output_text || "No text output returned." });

  } catch (e) {
    return Response.json({ error: "Server error", details: String(e) }, { status: 500 });
  }
}

