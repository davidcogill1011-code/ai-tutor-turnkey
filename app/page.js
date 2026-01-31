"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

function parseSkills(replyText) {
  if (!replyText) return [];
  const idx = replyText.toLowerCase().lastIndexOf("## skills");
  if (idx === -1) return [];
  const after = replyText.slice(idx);
  const lines = after.split("\n").slice(1);
  const raw = (lines.join("\n") || "").trim();
  if (!raw) return [];
  const stopAt = raw.search(/\n##\s+/);
  const skillLine = (stopAt === -1 ? raw : raw.slice(0, stopAt)).trim();
  return skillLine
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function parseFeedbackMark(replyText) {
  if (!replyText) return null;
  const m = replyText.match(/##\s*Feedback[\s\S]*?\n([✅❌])/i);
  if (!m) return null;
  return m[1] === "✅" ? "ok" : "no";
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const WAITLIST_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLScvsMNJmd0Kgj8ouhP_VKs1H5lDsO3LtvLdtjHCtx7LDDEv2Q/viewform?usp=header";

  const [view, setView] = useState("tutor"); // tutor | practice | report | proof

  const [subject, setSubject] = useState("Math");
  const [level, setLevel] = useState("Middle School");
  const [style, setStyle] = useState("Socratic");

  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  // Proof check input
  const [work, setWork] = useState("");

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

  const [mastery, setMastery] = useState({});
  const [events, setEvents] = useState([]);

  const [learningProfile, setLearningProfile] = useState(() => {
    if (typeof window === "undefined") return defaultProfile;
    const saved = localStorage.getItem("learningProfile");
    return saved ? JSON.parse(saved) : defaultProfile;
  });

  useEffect(() => {
    try {
      const m = localStorage.getItem("masteryStore");
      const e = localStorage.getItem("eventStore");
      if (m) setMastery(JSON.parse(m));
      if (e) setEvents(JSON.parse(e));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("masteryStore", JSON.stringify(mastery));
    } catch {}
  }, [mastery]);

  useEffect(() => {
    try {
      localStorage.setItem("eventStore", JSON.stringify(events.slice(-500)));
    } catch {}
  }, [events]);

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

  function updateTrackingFromReply(replyText) {
    const skills = parseSkills(replyText);
    const fb = parseFeedbackMark(replyText);
    if (!skills.length || !fb) return;

    const now = Date.now();
    const ok = fb === "ok";

    setMastery((prev) => {
      const next = { ...prev };
      for (const skill of skills) {
        const key = `${subject}|${level}|${skill}`;
        const cur = next[key] || { correct: 0, total: 0, lastAt: 0, streak: 0 };
        const total = cur.total + 1;
        const correct = cur.correct + (ok ? 1 : 0);
        const streak = ok ? cur.streak + 1 : 0;
        next[key] = { correct, total, lastAt: now, streak };
      }
      return next;
    });

    setEvents((prev) => [
      ...prev.slice(-480),
      ...skills.map((skill) => ({ ts: now, subject, level, skill, ok }))
    ]);
  }

  async function callAPI({ text, isAttempt, task }) {
    setLoading(true);
    setReply("");

    try {
      const nextHistory =
        task === "tutor" && sessionMode
          ? [...history, ...(text ? [{ role: "student", text }] : [])]
          : history;

      const nextAttempts = task === "tutor" && sessionMode && isAttempt ? attempts + 1 : attempts;
      if (task === "tutor" && sessionMode && isAttempt) setAttempts(nextAttempts);

      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: task || "tutor",
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

      if (task === "tutor" && sessionMode) setHistory([...nextHistory, { role: "tutor", text: out }]);

      if (task === "tutor") updateTrackingFromReply(out);
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
    await callAPI({ text: message, isAttempt: false, task: "tutor" });
  }

  async function submitStep() {
    if (!message.trim()) return;
    await callAPI({ text: message, isAttempt: true, task: "tutor" });
  }

  async function sendNormal() {
    if (!message.trim()) return;
    await callAPI({ text: message, isAttempt: false, task: "tutor" });
  }

  function resetSession() {
    setHistory([]);
    setAttempts(0);
    setReply("");
    setMessage("");
  }

  function clearProgress() {
    setMastery({});
    setEvents([]);
    try {
      localStorage.removeItem("masteryStore");
      localStorage.removeItem("eventStore");
    } catch {}
  }

  const inActiveSession = sessionMode && history.length > 0;

  const WaitlistBtn = ({ children, variant = "primary" }) => (
    <a className={`btnLink ${variant === "secondary" ? "btnSecondaryLink" : ""}`} href={WAITLIST_URL} target="_blank" rel="noreferrer">
      {children}
    </a>
  );

  const masteryRows = useMemo(() => {
    const rows = [];
    for (const [k, v] of Object.entries(mastery)) {
      const [s, l, skill] = k.split("|");
      if (s !== subject || l !== level) continue;
      const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
      rows.push({ skill, pct, correct: v.correct, total: v.total, streak: v.streak });
    }
    rows.sort((a, b) => a.pct - b.pct || b.total - a.total);
    return rows.slice(0, 10);
  }, [mastery, subject, level]);

  const learningPlan = useMemo(() => {
    const defaults =
      subject === "Math"
        ? ["Problem interpretation", "Inverse operations", "Checking solutions"]
        : ["Main idea", "Evidence", "Vocabulary in context"];

    const sorted = masteryRows.length ? masteryRows : defaults.map((s) => ({ skill: s, pct: 0, total: 0 }));
    return sorted.slice(0, 3).map((r, i) => ({
      step: i + 1,
      skill: r.skill,
      goal: r.total ? `Raise from ${r.pct}% to ${Math.min(95, r.pct + 20)}%` : "Build baseline accuracy"
    }));
  }, [masteryRows, subject]);

  const recommendedSkill = learningPlan[0]?.skill || (subject === "Math" ? "Inverse operations" : "Main idea");
  const [practiceSkill, setPracticeSkill] = useState(recommendedSkill);

  useEffect(() => {
    setPracticeSkill(recommendedSkill);
  }, [recommendedSkill]);

  const weekly = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const filtered = events.filter((e) => e.ts >= weekAgo && e.subject === subject && e.level === level);
    const bySkill = {};
    for (const e of filtered) {
      bySkill[e.skill] = bySkill[e.skill] || { ok: 0, total: 0 };
      bySkill[e.skill].total += 1;
      if (e.ok) bySkill[e.skill].ok += 1;
    }
    const rows = Object.entries(bySkill).map(([skill, v]) => ({
      skill,
      pct: v.total ? Math.round((v.ok / v.total) * 100) : 0,
      ok: v.ok,
      total: v.total
    }));
    rows.sort((a, b) => b.total - a.total || b.pct - a.pct);

    const totalAttempts = filtered.length;
    const correct = filtered.filter((e) => e.ok).length;
    const accuracy = totalAttempts ? Math.round((correct / totalAttempts) * 100) : 0;

    return { totalAttempts, correct, accuracy, rows };
  }, [events, subject, level]);

  function exportWeeklyCSV() {
    const lines = [
      "skill,correct,total,accuracy_percent",
      ...weekly.rows.map((r) => `"${r.skill.replace(/"/g, '""')}",${r.ok},${r.total},${r.pct}`)
    ];
    downloadText(`weekly_report_${subject}_${level}.csv`, lines.join("\n"));
  }

  async function generatePractice() {
    const prompt = `Create a practice set focused on: ${practiceSkill}.`;
    await callAPI({ text: prompt, isAttempt: false, task: "practice" });
  }

  async function gradeWork() {
    if (!work.trim()) return;
    const prompt = `Problem + student work:\n\n${work}\n\nGrade it using the rubric.`;
    await callAPI({ text: prompt, isAttempt: false, task: "grade" });
  }

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
          <div className="badge">School Pilot</div>
        </div>
      </div>

      <div className={`container ${wrapperClass}`}>
        {/* Tabs */}
        <div className="card" style={{ marginTop: 12, marginBottom: 12 }}>
          <div className="btnRow">
            <button className={view === "tutor" ? "" : "btnSecondary"} onClick={() => setView("tutor")}>Tutor</button>
            <button className={view === "practice" ? "" : "btnSecondary"} onClick={() => setView("practice")}>Practice</button>
            <button className={view === "proof" ? "" : "btnSecondary"} onClick={() => setView("proof")}>Proof Check</button>
            <button className={view === "report" ? "" : "btnSecondary"} onClick={() => setView("report")}>Report</button>
            <button className="btnSecondary" onClick={clearProgress}>Clear progress</button>
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            Current: <b>{subject}</b> • <b>{level}</b>
          </div>
        </div>

        {/* Adaptive plan */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="sectionTitle">Adaptive learning plan</div>
          <div className="small" style={{ marginBottom: 10 }}>
            Recommends what to practice next based on recent performance.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {learningPlan.map((p) => (
              <div key={p.step} style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--border)", background: "#fff" }}>
                <div style={{ fontWeight: 900 }}>Step {p.step}: {p.skill}</div>
                <div className="small">{p.goal}</div>
              </div>
            ))}
          </div>

          <div className="ctaBar" style={{ marginTop: 12 }}>
            <div>
              <div style={{ fontWeight: 950, letterSpacing: "-0.02em" }}>Recommended next</div>
              <div className="small">{recommendedSkill}</div>
            </div>
            <button onClick={() => setView("practice")}>Open Practice</button>
          </div>
        </div>

        {/* Tutor */}
        {view === "tutor" && (
          <div className="card">
            <div className="toggles" style={{ marginBottom: 12 }}>
              <div className="toggle">
                <input type="checkbox" checked={sessionMode} onChange={(e) => setSessionMode(e.target.checked)} />
                <span>Session Mode (1 step)</span>
              </div>
              <div className="toggle">
                <input type="checkbox" checked={coachMode} onChange={(e) => setCoachMode(e.target.checked)} />
                <span>Coach Mode (Roadmap + checks)</span>
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
                <label>Attempts</label>
                <input type="text" value={`${attempts}`} readOnly />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label>{sessionMode ? (inActiveSession ? "Your next step attempt" : "Problem to start a session") : "Student question"}</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Paste the problem or your next step..." />
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

              <button type="button" className="btnSecondary" onClick={() => lastReplyRef.current && speak(lastReplyRef.current)}>
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
                <div className="reply" style={{ fontSize: 15 }}>{reply}</div>
              </div>
            )}
          </div>
        )}

        {/* Practice */}
        {view === "practice" && (
          <div className="card">
            <div className="sectionTitle">Practice generator</div>
            <div className="small" style={{ marginBottom: 10 }}>
              Generates practice based on your selected skill (no full solutions; hints only).
            </div>

            <label>Practice skill</label>
            <input value={practiceSkill} onChange={(e) => setPracticeSkill(e.target.value)} />

            <div className="btnRow" style={{ marginTop: 12 }}>
              <button onClick={generatePractice} disabled={loading}>
                {loading ? "Generating..." : "Generate practice set"}
              </button>
              <button className="btnSecondary" onClick={() => setPracticeSkill(recommendedSkill)}>
                Use recommended
              </button>
            </div>

            {reply && (
              <div className="card" style={{ marginTop: 14, borderLeft: "6px solid var(--blue)" }}>
                <div className="reply" style={{ fontSize: 15 }}>{reply}</div>
              </div>
            )}
          </div>
        )}

        {/* Proof Check */}
        {view === "proof" && (
          <div className="card">
            <div className="sectionTitle">Student Proof Check</div>
            <div className="small" style={{ marginBottom: 10 }}>
              Paste the problem + your work. The tutor grades it like a teacher and gives one correction + next step.
            </div>

            <label>Paste problem + your work</label>
            <textarea
              value={work}
              onChange={(e) => setWork(e.target.value)}
              placeholder={`Example:\nProblem: 2x + 5 = 17\nMy work:\n2x = 12\nx = 6`}
              style={{ minHeight: 160 }}
            />

            <div className="btnRow" style={{ marginTop: 12 }}>
              <button onClick={gradeWork} disabled={loading}>
                {loading ? "Grading..." : "Grade my work"}
              </button>
              <button className="btnSecondary" onClick={() => setWork("")}>Clear</button>
            </div>

            {reply && (
              <div className="card" style={{ marginTop: 14, borderLeft: "6px solid var(--blue)" }}>
                <div className="reply" style={{ fontSize: 15 }}>{reply}</div>
              </div>
            )}
          </div>
        )}

        {/* Report */}
        {view === "report" && (
          <div className="card">
            <div className="sectionTitle">Weekly report</div>
            <div className="small" style={{ marginBottom: 10 }}>
              Last 7 days (this device). Export for parents/schools.
            </div>

            <div className="row">
              <div className="plan">
                <div style={{ fontWeight: 900 }}>Attempts</div>
                <div className="price">{weekly.totalAttempts}</div>
                <div className="small">Total skill events recorded</div>
              </div>
              <div className="plan">
                <div style={{ fontWeight: 900 }}>Accuracy</div>
                <div className="price">{weekly.accuracy}%</div>
                <div className="small">{weekly.correct}/{weekly.totalAttempts} marked ✅</div>
              </div>
            </div>

            <div className="btnRow" style={{ marginTop: 12 }}>
              <button onClick={exportWeeklyCSV} className="btnSecondary">Download CSV</button>
            </div>

            <hr />
            <div className="sectionTitle">Most practiced skills</div>

            {weekly.rows.length === 0 ? (
              <div className="small">No weekly data yet. Use Tutor mode to start tracking.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {weekly.rows.slice(0, 10).map((r) => (
                  <div key={r.skill} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{r.skill}</div>
                      <div className="small">{r.pct}% • {r.ok}/{r.total}</div>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, border: "1px solid var(--border)", background: "#fff", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${clamp(r.pct, 0, 100)}%`, background: "var(--blue)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pricing / waitlist */}
        <div className="card" style={{ marginTop: 12 }}>
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
              <div className="price">$7<span className="small">/mo</span></div>
              <div className="small">Coach Mode + Practice + Proof Check + Reports</div>
              <div style={{ marginTop: 12 }}><WaitlistBtn variant="secondary">Join waitlist</WaitlistBtn></div>
            </div>

            <div className="plan" style={{ borderColor: "rgba(37,99,235,.28)" }}>
              <div className="planTop">
                <div>
                  <div className="planName">Family</div>
                  <div className="small">Up to 3 students</div>
                </div>
                <div className="planTag">Best value</div>
              </div>
              <div className="price">$15<span className="small">/mo</span></div>
              <div className="small">Multiple learners + shared reporting</div>
              <div style={{ marginTop: 12 }}><WaitlistBtn>Join waitlist</WaitlistBtn></div>
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
              <div className="small">Pilot-ready reporting + onboarding</div>
              <div style={{ marginTop: 12 }}><WaitlistBtn variant="secondary">Request pilot</WaitlistBtn></div>
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
      </div>
    </>
  );
}
