// app/api/tutor/route.js
export const runtime = "nodejs";

/**
 * Premium "Teach-Not-Solve" Tutor API
 * - Coach Mode (Roadmap + checks) for a one-of-a-kind interactive feel
 * - Session Mode: one micro-step at a time, with feedback + next step
 * - Safe defaults + Demo mode fallback if OPENAI_API_KEY missing
 */

function buildTutorPrompt({
  subject,
  level,
  style,
  accessibility,
  learningProfile,
  mode,
  coachMode,
  attempts,
  history,
  studentMessage
}) {
  const a = accessibility || {};
  const p = learningProfile || {};
  const isSession = mode === "session";
  const coach = !!coachMode;

  const flags = {
    adhd: !!p.adhd,
    dyslexia: !!p.dyslexia,
    dyscalculia: !!p.dyscalculia,
    autism: !!p.autism,
    anxiety: !!p.anxiety,
    ell: !!p.ell
  };

  const transcript =
    Array.isArray(history) && history.length
      ? history
          .slice(-18)
          .map((m) => `${(m.role || "").toUpperCase()}: ${m.text || ""}`)
          .join("\n")
      : "(none)";

  return `
You are "AI Tutor", a school-safe tutor that TEACHES and does NOT simply solve.
You must act like an interactive tutor: ask, wait, check, then continue.

Context:
- Subject: ${subject || "General"}
- Level: ${level || "Unknown"}
- Preferred style: ${style || "Socratic + step-by-step"}
- Mode: ${isSession ? "SESSION (one micro-step at a time)" : "NORMAL"}
- Coach Mode: ${coach ? "ON" : "OFF"}
- Attempts so far: ${attempts || 0}

Accessibility toggles:
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
3) If asked for the final answer: only provide it if attempts >= 3; otherwise require one more attempt.
4) Keep tone supportive and professional (school tone). No shaming language.

Coach Mode behavior (if ON):
- Provide a short Roadmap (3–5 steps) at the start of a session OR if the student changes the problem/topic.
- Only one step at a time.
- Ask a check-for-understanding question every ~2 tutor turns (brief).
- If the student gives an incorrect step, briefly explain what's wrong and ask for a corrected attempt. Do not continue to the next step.

Output format rules:

If Mode = SESSION:
Return EXACTLY these sections, in order:

## Feedback
(✅ or ❌ + 1–2 short lines about the student's last step)

## Roadmap
(Only include if this is the first tutor message of the session OR the student restarted/changed the problem. 3–5 steps max. If not needed, write: "—")

## Next step
(ONE instruction or question only. End with a prompt for the student to respond.)

## Check
(One short question that confirms understanding. If it's not time for a check, write: "Answer with your step.")

If Mode = NORMAL:
Return:
## Goal
## Roadmap
## Step 1 (Your turn)
## Hint
## Check Understanding

Style guidance:
- Use math layout when helpful (aligned steps / mini tables).
- If Plain language is ON: short sentences, simple words.
- If Focus mode is ON: keep responses very short.

Conversation so far:
${transcript}

Student message:
"""${studentMessage}"""
`;
}

function demoReply({ mode }) {
  if (mode === "session") {
    return `## Feedback
✅ Demo mode is on (no API key set).

## Roadmap
1) Identify what the question asks for
2) Undo +/− operations
3) Undo ×/÷ operations
4) Check the result in the original problem

## Next step
What is the variable we are trying to find?

## Check
Answer in one short sentence.`;
  }

  return `## Goal
Learn the method step-by-step (teach-not-solve).

## Roadmap
1) Identify the target (what you’re solving for)
2) Undo +/− first
3) Undo ×/÷ next
4) Check by substituting back

## Step 1 (Your turn)
What is the problem asking you to find?

## Hint
Look for the letter (like x). That’s usually what we solve for.

## Check Understanding
What does x represent in this problem?`;
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
      coachMode = true,
      history = [],
      message,
      attempts = 0
    } = body || {};

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Missing message" }, { status: 400 });
    }

    // Demo fallback so the app still works without a key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ reply: demoReply({ mode }) });
    }

    const prompt = buildTutorPrompt({
      subject,
      level,
      style,
      accessibility,
      learningProfile,
      mode,
      coachMode,
      attempts,
      history,
      studentMessage: message
    });

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
