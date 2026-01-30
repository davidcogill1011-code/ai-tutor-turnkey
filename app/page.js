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

const defaultProfile = {
  adhd: false,
  dyslexia: false,
  dyscalculia: false,
  autism: false,
  anxiety: false,
  ell: false
};

export default function Page() {
  const WAITLIST_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLScvsMNJmd0Kgj8ouhP_VKs1H5lDsO3LtvLdtjHCtx7LDDEv2Q/viewform?usp=header";

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

  // Learning profile (saved locally)
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

  const WaitlistBtn = ({ children, variant = "primary" }) => (
    <a
      className={`btnLink ${variant === "secondary" ? "btnSecondaryLink" : ""}`}
      href={WAITLIST_URL}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );

  return (
    <>
      {/* Top bar */}
      <div className="topbar">
        <div className="topbarInner">
          <div className="topbarLeft">
            <div className="logoDot" aria-hidden="true" />
            <div>
              <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>AI Tutor</div>
              <div className="small">Teach-not-solve • School-safe</div>
            </div>
          </div>
          <div className="badge">School Pilot</div>
        </div>
      </div>

      <div className={`container ${wrapperClass}`}>
        <p className="small secondary" style={{ marginTop: 10 }}>
          Every learner gets one-on-one help, even when human tutoring resources aren’t available.
        </p>

        {/* Main tutor card */}
        <div className="card" style={{ marginTop: 12 }}>
          {/* How it works */}
          <div
            className="cardTight"
            style={{
              background: "var(--blueSoft)",
              border: "1px solid rgba(37,99,235,.18)",
              borderRadius: 16,
              marginBottom: 12
            }}
          >
            <div className="sectionTitle">How it works</div>
            <div className="small" style={{ lineHeight: 1.6 }}>
              <div>• <b>Teaches, not solves:</b> guides thinking and asks for student steps.</div>
              <div>• <b>Session Mode:</b> one micro-step at a time to reduce overwhelm and build skill.</div>
              <div>• <b>Learning supports:</b> optional settings for focus, dyslexia-friendly text, and ELL.</div>
            </div>
          </div>

          {/* Settings toggles */}
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

          {/* Learning profile */}
          <div style={{ marginBottom: 12 }}>
            <div className="sectionTitle">Learning profile (optional)</div>
            <div className="toggles">
              {[
                ["adhd", "ADHD / Focus support"],
                ["dyslexia", "Dyslexia support"],
                ["dyscalculia", "Dyscalculia support"],
                ["autism", "Autism-friendly"],
                ["anxiety", "Anxiety-sensitive"],
                ["ell", "English learner (ELL)"]
              ].map(([k, label]) => (
                <div className="toggle" key={k}>
                  <input type="checkbox" checked={learningProfile[k]} onChange={() => toggleProfile(k)} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selectors */}
          <div className="row">
            <div>
              <label>Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option>Math</option>
                <option>Reading</option>
                <option>Writing</option>
                <option>Science</option>
                <option>History</option>
                <option>General</option>
              </select>
            </div>

            <div>
              <label>Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option>Elementary</option>
                <option>Middle School</option>
                <option>High School</option>
                <option>College</option>
                <option>Adult learner</option>
              </select>
            </div>

            <div>
              <label>Teaching style</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option>Socratic</option>
                <option>Step-by-step</option>
                <option>Examples-first</option>
                <option>Visual descriptions</option>
                <option>Quiz me</option>
              </select>
            </div>

            <div>
              <label>Attempts (unlock final answer)</label>
              <input type="text" value={`${attempts}`} readOnly />
            </div>
          </div>

          {/* Input */}
          <div style={{ marginTop: 12 }}>
            <label>
              {sessionMode
                ? inActiveSession
                  ? "Your next step attempt"
                  : "Problem to start a session"
                : "Student question"}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                sessionMode
                  ? inActiveSession
                    ? "Type your next step (example: 'Subtract 5 from both sides')."
                    : "Paste the problem (example: 'Solve 2x + 5 = 17')."
                  : "Ask a question (example: 'How do I solve 2x + 5 = 17?')"
              }
            />
          </div>

          {/* Buttons */}
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

          {/* Reply */}
          {reply && (
            <div className="card" style={{ marginTop: 14, borderLeft: "6px solid var(--blue)" }}>
              <div className="reply" style={{ fontSize: 15 }}>
                {reply}
              </div>
            </div>
          )}

          {/* Transcript */}
          {sessionMode && history.length > 0 && (
            <>
              <hr />
              <div className="sectionTitle">Session transcript</div>
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

          {/* Pricing + Waitlist */}
          <hr />
          <div style={{ marginTop: 10 }}>
            <div className="sectionTitle">Pricing (Early Access)</div>

            <div className="pricingGrid">
              <div className="plan">
                <div className="planTop">
                  <div>
                    <div className="planName">Student</div>
                    <div className="small">For individual learners</div>
                  </div>
                  <div className="planTag">Popular</div>
                </div>
                <div className="price">
                  $7<span className="small">/mo</span>
                </div>
                <div className="small">Step-by-step tutoring across subjects + learning supports.</div>
                <div style={{ marginTop: 12 }}>
                  <WaitlistBtn variant="secondary">Join waitlist</WaitlistBtn>
                </div>
              </div>

              <div className="plan" style={{ borderColor: "rgba(37,99,235,.28)" }}>
                <div className="planTop">
                  <div>
                    <div className="planName">Family</div>
                    <div className="small">Up to 3 students</div>
                  </div>
                  <div className="planTag">Best value</div>
                </div>
                <div className="price">
                  $15<span className="small">/mo</span>
                </div>
                <div className="small">One household plan for siblings — same safe tutoring experience.</div>
                <div style={{ marginTop: 12 }}>
                  <WaitlistBtn>Join waitlist</WaitlistBtn>
                </div>
              </div>

              <div className="plan">
                <div className="planTop">
                  <div>
                    <div className="planName">School Pilot</div>
                    <div className="small">Classroom or district access</div>
                  </div>
                  <div className="planTag">B2B</div>
                </div>
                <div className="price">Custom</div>
                <div className="small">Pilot with policy alignment, onboarding, and reporting options.</div>
                <div style={{ marginTop: 12 }}>
                  <WaitlistBtn variant="secondary">Request pilot</WaitlistBtn>
                </div>
              </div>
            </div>

            <div className="ctaBar">
              <div>
                <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Get Early Access</div>
                <div className="small">Join the waitlist and help shape the first school-ready AI tutor.</div>
              </div>
              <WaitlistBtn>Join waitlist</WaitlistBtn>
            </div>
          </div>

          {/* Footer trust */}
          <div className="small" style={{ marginTop: 16, textAlign: "center" }}>
            School-safe tutoring experience: step-by-step guidance that encourages student thinking.
            <br />
            Please don’t enter sensitive personal information. Use in accordance with your school or family policies.
          </div>
        </div>
      </div>
    </>
  );
}
