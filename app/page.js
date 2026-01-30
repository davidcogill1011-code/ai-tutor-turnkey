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

  // Modes
  const [sessionMode, setSessionMode] = useState(true);
  const [coachMode, setCoachMode] = useState(true);

  // Accessibility
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [plainLanguage, setPlainLanguage] = useState(true);
  const [readAloud, setReadAloud] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const [history, setHistory] = useState([]);
  const [attempts, setAttempts] = useState(0);

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
          coachMode,
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
      setReply("Could not reach tutor API.");
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

  function resetSession() {
    setHistory([]);
    setAttempts(0);
    setReply("");
    setMessage("");
  }

  const inActiveSession = sessionMode && history.length > 0;

  const WaitlistBtn = ({ children }) => (
    <a
      className="btnLink"
      href={WAITLIST_URL}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );

  return (
    <>
      <div className={`container ${wrapperClass}`}>
        <h1>AI Tutor</h1>
        <p className="small">Teach-not-solve • One-on-one coaching</p>

        <div className="card">

          {/* Toggles */}
          <div className="toggles">
            <label><input type="checkbox" checked={sessionMode} onChange={e=>setSessionMode(e.target.checked)} /> Session Mode</label>
            <label><input type="checkbox" checked={coachMode} onChange={e=>setCoachMode(e.target.checked)} /> Coach Mode</label>
            <label><input type="checkbox" checked={dyslexiaMode} onChange={e=>setDyslexiaMode(e.target.checked)} /> Dyslexia</label>
            <label><input type="checkbox" checked={plainLanguage} onChange={e=>setPlainLanguage(e.target.checked)} /> Plain Language</label>
            <label><input type="checkbox" checked={readAloud} onChange={e=>setReadAloud(e.target.checked)} /> Read Aloud</label>
            <label><input type="checkbox" checked={focusMode} onChange={e=>setFocusMode(e.target.checked)} /> Focus</label>
          </div>

          {/* Learning Profile */}
          <div className="toggles">
            {Object.keys(defaultProfile).map(k=>(
              <label key={k}>
                <input type="checkbox" checked={learningProfile[k]} onChange={()=>toggleProfile(k)} />
                {k}
              </label>
            ))}
          </div>

          {/* Selectors */}
          <div className="row">
            <select value={subject} onChange={e=>setSubject(e.target.value)}>
              <option>Math</option>
              <option>Reading</option>
              <option>Science</option>
              <option>History</option>
            </select>

            <select value={level} onChange={e=>setLevel(e.target.value)}>
              <option>Elementary</option>
              <option>Middle School</option>
              <option>High School</option>
              <option>College</option>
            </select>
          </div>

          {/* Input */}
          <textarea
            value={message}
            onChange={e=>setMessage(e.target.value)}
            placeholder={
              inActiveSession
                ? "Type your next step..."
                : "Enter a problem to start..."
            }
          />

          {/* Buttons */}
          {!inActiveSession && (
            <button onClick={startSession} disabled={loading}>
              {loading ? "Starting..." : "Start Session"}
            </button>
          )}

          {inActiveSession && (
            <button onClick={submitStep} disabled={loading}>
              {loading ? "Checking..." : "Submit Step"}
            </button>
          )}

          {sessionMode && (
            <button className="btnSecondary" onClick={resetSession}>
              Reset
            </button>
          )}

          {/* Reply */}
          {reply && (
            <div className="card">
              <div>{reply}</div>
            </div>
          )}

          {/* Transcript */}
          {history.length > 0 && (
            <div className="card">
              {history.map((m,i)=>(
                <div key={i}>
                  <b>{m.role}</b>: {m.text}
                </div>
              ))}
            </div>
          )}

          {/* Pricing */}
          <hr />

          <h2>Early Access</h2>

          <div className="pricingGrid">
            <div className="plan">
              <b>Student</b>
              <div>$7 / mo</div>
              <WaitlistBtn>Join waitlist</WaitlistBtn>
            </div>

            <div className="plan">
              <b>Family</b>
              <div>$15 / mo</div>
              <WaitlistBtn>Join waitlist</WaitlistBtn>
            </div>

            <div className="plan">
              <b>School Pilot</b>
              <div>Custom</div>
              <WaitlistBtn>Request pilot</WaitlistBtn>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
