export const runtime = "nodejs";

/**
 * Teach-not-solve Tutor API (school-safe)
 * Tasks:
 * - tutor: interactive coaching (Roadmap + checks) + skill tags
 * - practice: practice set generator (no full solutions; hints + answer checks)
 * - grade: "Student Proof Check" – grades student work like a teacher and gives one correction + next step
 */

function buildPrompt({
  task,
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

  const base = `
You are "AI Tutor", a school-safe tutor that TEACHES and does NOT simply solve.
Act like a real teacher: ask, wait, check, then continue.

Context:
- Task: ${task}
- Subject: ${subject || "General"}
- Level: ${level || "Unknown"}
- Preferred style: ${style || "Socratic + step-by-step"}
- Mode: ${isSession ? "SESSION (one micro-step at a time)" : "NORMAL"}
- Coach Mode: ${coach ? "ON" : "OFF"}
- Attempts so far: ${attempts || 0}

Accessibility:
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

Non-negotiable:
1) Do NOT provide the final answer immediately in tutoring.
2) Prefer guiding questions + tiny hints.
3) If asked for the final answer: only provide it if attempts >= 3; otherwise require one more attempt.
4) Keep tone supportive and professional. No shame.
5) Always include a final section "## Skills" with 2–5 comma-separated tags.

Conversation so far:
${transcript}

User message:
"""${studentMessage}"""
`;

  if (task === "practice") {
    return `
${base}

You are generating PRACTICE (not tutoring a single problem).

Rules:
- Create 6 questions aligned to level and skill/topic.
- Do NOT provide full solutions.
- Provide a short hint for each.
- Provide "Answer check" final value/choice only (no steps).
- Vary difficulty: easy → medium → challenge.

OUTPUT FORMAT (exact):

## Practice set
1) Question...
   Hint: ...
   Answer check: ...

(repeat 6 items)

## How to use this
(2–4 lines)

## Skills
(Comma-separated tags)
`;
  }

  if (task === "grade") {
    return `
${base}

You are doing a "Student Proof Check".
The student pasted their work/step(s). Grade it like a teacher.

Rules for grading:
- Be strict but supportive.
- Identify correctness and the FIRST mistake if any.
- Do NOT rewrite the full solution.
- Give ONE correction action only (the smallest fix).
- Then give ONE next step question.
- If the work is correct, praise briefly.
- If incorrect, explain misconception in 1–2 lines.

OUTPUT FORMAT (exact):

## Grade
Score: X/10
Verdict: Correct / Partially correct / Incorrect

## What you did well
(1–2 lines)

## First issue
(If incorrect/partial: name the first mistake and why. If correct: "—")

## Fix (one step)
(One minimal correction instruction only)

## Next step
(One question/instruction; student's turn)

## Skills
(Comma-separated tags)
`;
  }

  // tutor task
  return `
${base}

Coach Mode behavior (if ON):
- Provide a short Roadmap (3–5 steps) at the start of a session OR if the student changes the problem/topic.
- Only one step at a time.
- Ask a check-for-understanding question every ~2 tutor turns.
- If incorrect step: brief feedback, ask for corrected attempt, do not continue.

Output format rules:

If Mode = SESSION:
Return EXACTLY these sections, in order:

## Feedback
(✅ or ❌ + 1–2 lines about the student's last step)

## Roadmap
(Only if first tutor message of the session or student changed problem; else "—")

## Next step
(ONE instruction/question only. End with a prompt for the student.)

## Check
(One short understanding check; or "Answer with your step.")

## Skills
(Comma-separated tags)

If Mode = NORMAL:
Return:
## Goal
## Roadmap
## Step 1 (Your turn)
## Hint
## Check Understanding
## Skills

Style:
- Use math layout when helpful.
- If Plain language ON: short sentences.
- If Focus mode ON: keep very short.
`;
}

function demoReply({ task, mode }) {
  if (task === "practice") {
    return `## Practice set
1) Solve: 2x + 5 = 17
   Hint: Undo +5 first.
   Answer check: x = 6

2) Solve: 3x - 4 = 11
   Hint: Add 4 to both sides.
   Answer check: x = 5

3) Solve: x/4 + 2 = 7
   Hint: Subtract 2 first.
   Answer check: x = 20

4) Solve: 5(x - 1) = 20
   Hint: Divide by 5 first.
   Answer check: x = 5

5) Solve: 2x + 3x = 25
   Hint: Combine like terms.
   Answer check: x = 5

6) Challenge: 4(x + 2) - 3 = 21
   Hint: Add 3, then divide by 4.
   Answer check: x = 4

## How to use this
Try #1–#3 first. If stuck, submit your next step to the tutor.

## Skills
Linear equations, Inverse operations, Combining like terms`;
  }

  if (task === "grade") {
    return `## Grade
Score: 7/10
Verdict: Partially correct

## What you did well
You identified the correct operation to remove the constant.

## First issue
You applied the operation to only one side of the equation.

## Fix (one step)
Apply the same operation to both sides.

## Next step
Rewrite the equation after doing that.

## Skills
Equation balance, Inverse operations, Linear equations`;
  }

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
Answer with your step.

## Skills
Problem interpretation, Linear equations, Inverse operations`;
  }

  return `## Goal
Learn the method step-by-step (teach-not-solve).

## Roadmap
1) Identify the target
2) Undo +/− first
3) Undo ×/÷ next
4) Check by substituting back

## Step 1 (Your turn)
What is the problem asking you to find?

## Hint
Look for the letter (like x).

## Check Understanding
What does x represent?

## Skills
Problem interpretation, Linear equations, Inverse operations`;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      task = "tutor",
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

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ reply: demoReply({ task, mode }) });
    }

    const prompt = buildPrompt({
      task,
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
      return Response.json({ error: "OpenAI error", details: data }, { status: 500 });
    }

    return Response.json({ reply: data.output_text || "No text output returned." });
  } catch (e) {
    return Response.json({ error: "Server error", details: String(e) }, { status: 500 });
  }
}
