"use client";

import { useMemo, useRef, useState } from "react";

function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {}
}

const defaultProfile = { adhd:false, dyslexia:false, dyscalculia:false, autism:false, anxiety:false, ell:false };

export default function Page() {
  const [subject, setSubject] = useState("Math");
  const [level, setLevel] = useState("Middle School");
  const [style, setStyle] = useState("Socratic");

  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  // Accessibility
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [plainLanguage, setPlainLanguage] = useState(true);
  const [readAloud, setReadAloud] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Session Mode
  const [sessionMode, setSessionMode] = useState(true);
  const [history, setHistory] = useState([]); // {role:"student"|"tutor", text}
  const [attempts, setAttempts] = useState(0);

  // Learning profile (saved)
  const [learningProfile, setLearningProfile] = useState(() => {
    if (typeof window === "undefined") return defaultProfile;
    const saved = localStorage.getItem("learningProfile");
    return saved ? JSON.parse(saved) : defaultProfile;
  });

  function toggleProfile(key) {
    setLearningProfile((p) => {
      const next = { ...p, [key]: !p[key] };
      localStorage.setItem("learningProfile", JSON.stringify(next));
      return next;
    });
  }

  const wrapperClass = useMemo(() => {
    const c = [];
    if (dyslexiaMode) c.push("dyslexiaOn");
    if (focusMode) c.push("focusOn");
    return c.join(" ");
  }, [dyslexiaMode, focusMode]);

  const lastReplyRef = useRef("");

  async function callTutor({ text, isAttempt }) {
    setLoading(true);
    setReply("");

    try {
      const nextHistory = sessionMode
        ? [...history, ...(text ? [{ role: "student", text }] : [])]
        : history;

      const nextAttempts = sessionMode && isAttempt ? attempts + 1 : attempts;
      if (sessionMode && isAttempt) setAttempts(nextAttempts);

      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          level,
          style,
          accessibility: { dyslexiaMode, plainLanguage, focusMode },
          learningProfile,
          mode: sessionMode ? "session" : "normal",
          history: nextHistory,
          message: text,
          attempts: nextAttempts
        })
      });

      const data = await r.json();
      const out = data.reply || data.error || "No response.";
      setReply(out);
      lastReplyRef.current = out;

      if (readAloud) speak(out);

      if (sessionMode) {
        setHistory([...nextHistory, { role: "tutor", text: out }]);
      }
    } catch {
      setReply("Could not reach the tutor API.");
    } finally {
      setLoading(false);
    }
  }

  async function startSession() {
    if (!message.trim()) return;
    setHistory([]);
    setAttempts(0);
    await callTutor({ text: message, isAttempt: false });
  }

  async function submitStep() {
    if (!message.trim()) return;
    await callTutor({ text: message, isAttempt: true });
  }

  async function sendNormal() {
    if (!message.trim()) return;
    await callTutor({ text: message, isAttempt: false });
  }

  function resetSession() {
    setHistory([]);
    setAttempts(0);
    setReply("");
    setMessage("");
  }

  const inActiveSession = sessionMode && history.length > 0;

 return (
  <>
    <div className="topbar">
      <div className="topbarInner">
        <div className="topbarLeft">
          <div className="logoDot" aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>AI Tutor</div>
            <div className="small">Teach-not-solve • School-safe</div>
          </div>
        </div>
        <div className="badge">Beta</div>
      </div>
    </div>

    <div className={`container ${wrapperClass}`}>

     <div className="header">
  <div className="brand">
    <div className="logoDot" aria-hidden="true" />
    <div>
      <h1 className="h1">AI Tutor</h1>
      <p className="tagline">School-safe, step-by-step learning support that teaches — not solves.</p>
    </div>
  </div>
</div>
<p className="small secondary">
  Every student gets one-on-one help, even when staffing and tutoring resources aren’t available.
</p>


      <div className="card" style={{ marginTop: 12 }}>
        <div className="toggles" style={{ marginBottom: 12 }}>
          <div className="toggle">
            <input type="checkbox" checked={sessionMode} onChange={(e) => setSessionMode(e.target.checked)} />
            <span>Session Mode (1 step)</span>
          </div>
          <div className="toggle">
            <input type="checkbox" checked={dyslexiaMode} onChange={(e) => setDyslexiaMode(e.target.checked)} />
            <span>Dyslexia-friendly</span>
          </div>
          <div className="toggle">
            <input type="checkbox" checked={plainLanguage} onChange={(e) => setPlainLanguage(e.target.checked)} />
            <span>Plain language</span>
          </div>
          <div className="toggle">
            <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} />
            <span>Read aloud</span>
          </div>
          <div className="toggle">
            <input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} />
            <span>Focus mode</span>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="small" style={{ marginBottom: 8, fontWeight: 600 }}>Learning Profile (optional)</div>
          <div className="toggles">
            {[
              ["adhd","ADHD / Focus support"],
              ["dyslexia","Dyslexia support"],
              ["dyscalculia","Dyscalculia support"],
              ["autism","Autism-friendly"],
              ["anxiety","Anxiety-sensitive"],
              ["ell","English learner (ELL)"],
            ].map(([k,label]) => (
              <div className="toggle" key={k}>
                <input type="checkbox" checked={learningProfile[k]} onChange={() => toggleProfile(k)} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="row">
          <div>
            <label>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option>Math</option><option>Reading</option><option>Writing</option>
              <option>Science</option><option>History</option><option>General</option>
            </select>
          </div>
          <div>
            <label>Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option>Elementary</option><option>Middle School</option><option>High School</option>
              <option>College</option><option>Adult learner</option>
            </select>
          </div>
          <div>
            <label>Teaching style</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option>Socratic</option><option>Step-by-step</option><option>Examples-first</option>
              <option>Visual descriptions</option><option>Quiz me</option>
            </select>
          </div>
          <div>
            <label>Attempts (unlock final answer)</label>
            <input type="text" value={`${attempts}`} readOnly />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>{sessionMode ? (inActiveSession ? "Your next step attempt" : "Problem to start a session") : "Student question"}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              sessionMode
                ? (inActiveSession
                    ? "Type your next step (example: 'Subtract 5 from both sides')."
                    : "Paste the problem (example: 'Solve 2x + 5 = 17').")
                : "Ask a question (example: 'How do I solve 2x + 5 = 17?')"
            }
          />
        </div>

        <div className="btnRow" style={{ marginTop: 12 }}>

          {!sessionMode && (
            <button onClick={sendNormal} disabled={loading}>
              {loading ? "Thinking..." : "Teach me"}
            </button>
          )}

          {sessionMode && !inActiveSession && (
            <button onClick={startSession} disabled={loading}>
              {loading ? "Starting..." : "Start session"}
            </button>
          )}

          {sessionMode && inActiveSession && (
            <button onClick={submitStep} disabled={loading}>
              {loading ? "Checking..." : "Submit my step"}
            </button>
          )}

         <button
  type="button"
  className="btnSecondary"
  onClick={() => lastReplyRef.current && speak(lastReplyRef.current)}
>
  Read last reply 🔊
</button>


          {sessionMode && (
            <button type="button" className="btnSecondary" onClick={resetSession}>
  Reset ♻️
</button>

          )}
        </div>

       {reply && (
  <div className="card" style={{ marginTop: 14, borderLeft: "6px solid var(--blue)" }}>
    <div className="reply">{reply}</div>
  </div>
)}


        {sessionMode && history.length > 0 && (
          <>
            <hr />
            <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Session transcript</div>
            <div className="reply">
  {history.map((m, i) => (
    <div
      key={i}
      style={{
        marginBottom: 10,
        padding: "10px 12px",
        borderRadius: 14,
        background: m.role === "student" ? "var(--blueSoft)" : "#fff",
        border: "1px solid var(--border)"
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4 }}>
        {m.role === "student" ? "Student" : "Tutor"}
      </div>
      <div>{m.text}</div>
    </div>
  ))}
</div>

          </>
        )}
      </div>
      </div>
  </>
);
}

