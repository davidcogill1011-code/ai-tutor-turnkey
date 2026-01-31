
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Speech ---------- */
function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {}
}

/* ---------- Defaults ---------- */
const defaultProfile = {
  adhd:false,
  dyslexia:false,
  dyscalculia:false,
  autism:false,
  anxiety:false,
  ell:false
};

/* ---------- Page ---------- */
export default function Page(){

  const DEMO_PROMPT =
`Solve 2x + 5 = 17 using step-by-step reasoning.
Start in coaching session mode.
Do not give the final answer.
Ask me for the first step.`;

  const WAITLIST_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScvsMNJmd0Kgj8ouhP_VKs1H5lDsO3LtvLdtjHCtx7LDDEv2Q/viewform?usp=header";

  const [subject,setSubject] = useState("Math");
  const [level,setLevel] = useState("Middle School");

  const [message,setMessage] = useState("");
  const [reply,setReply] = useState("");
  const [loading,setLoading] = useState(false);

  const [sessionMode,setSessionMode] = useState(true);
  const [coachMode,setCoachMode] = useState(true);

  const [readAloud,setReadAloud] = useState(false);
  const [plainLanguage,setPlainLanguage] = useState(true);
  const [focusMode,setFocusMode] = useState(false);

  const [history,setHistory] = useState([]);
  const [attempts,setAttempts] = useState(0);

  const [learningProfile,setLearningProfile] = useState(defaultProfile);

  const lastReplyRef = useRef("");

  /* ---------- API ---------- */
  async function callTutor(text,isAttempt){
    setLoading(true);
    setReply("");

    try{
      const nextHistory =
        sessionMode ? [...history,{role:"student",text}] : history;

      const nextAttempts =
        sessionMode && isAttempt ? attempts+1 : attempts;

      if(isAttempt) setAttempts(nextAttempts);

      const r = await fetch("/api/tutor",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          task:"tutor",
          subject,
          level,
          mode: sessionMode ? "session":"normal",
          coachMode,
          accessibility:{ plainLanguage, focusMode },
          learningProfile,
          history: nextHistory,
          message: text,
          attempts: nextAttempts
        })
      });

      const data = await r.json();
      const out = data.reply || "No response.";
      setReply(out);
      lastReplyRef.current = out;

      if(readAloud) speak(out);

      if(sessionMode){
        setHistory([...nextHistory,{role:"tutor",text:out}]);
      }

    }catch{
      setReply("Could not reach tutor API.");
    }finally{
      setLoading(false);
    }
  }

  /* ---------- Actions ---------- */
  async function startSession(){
    if(!message.trim()) return;
    setHistory([]);
    setAttempts(0);
    await callTutor(message,false);
  }

  async function submitStep(){
    if(!message.trim()) return;
    await callTutor(message,true);
  }

  async function startDemo(){
    setHistory([]);
    setAttempts(0);
    setMessage("");
    await callTutor(DEMO_PROMPT,false);
  }

  function resetSession(){
    setHistory([]);
    setAttempts(0);
    setMessage("");
    setReply("");
  }

  const inSession = sessionMode && history.length>0;

  /* ---------- UI ---------- */
  return(
<>
<div className="container">

<h1>AI Tutor</h1>
<p className="small">Teach-not-solve • One-on-one coaching</p>

<div className="card">

{/* DEMO BUTTON */}
<button onClick={startDemo}>
▶ Try Demo Lesson
</button>

<hr/>

{/* MODES */}
<div className="toggles">
<label>
<input type="checkbox"
checked={sessionMode}
onChange={e=>setSessionMode(e.target.checked)}/>
Session Mode
</label>

<label>
<input type="checkbox"
checked={coachMode}
onChange={e=>setCoachMode(e.target.checked)}/>
Coach Mode
</label>

<label>
<input type="checkbox"
checked={plainLanguage}
onChange={e=>setPlainLanguage(e.target.checked)}/>
Plain Language
</label>

<label>
<input type="checkbox"
checked={focusMode}
onChange={e=>setFocusMode(e.target.checked)}/>
Focus Mode
</label>

<label>
<input type="checkbox"
checked={readAloud}
onChange={e=>setReadAloud(e.target.checked)}/>
Read Aloud
</label>
</div>

{/* SUBJECT */}
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

{/* INPUT */}
<textarea
value={message}
onChange={e=>setMessage(e.target.value)}
placeholder={
inSession ?
"Type your next step..." :
"Enter a problem to start..."
}
/>

{/* BUTTONS */}
{!inSession && (
<button onClick={startSession} disabled={loading}>
{loading?"Starting...":"Start Session"}
</button>
)}

{inSession && (
<button onClick={submitStep} disabled={loading}>
{loading?"Checking...":"Submit Step"}
</button>
)}

<button className="btnSecondary" onClick={resetSession}>
Reset
</button>

{/* REPLY */}
{reply && (
<div className="card">
{reply}
</div>
)}

{/* TRANSCRIPT */}
{history.length>0 && (
<div className="card">
{history.map((m,i)=>(
<div key={i}>
<b>{m.role}</b>: {m.text}
</div>
))}
</div>
)}

<hr/>

<h2>Early Access</h2>

<div className="pricingGrid">

<div className="plan">
<b>Student</b>
<div>$7 / mo</div>
<a className="btnLink" href={WAITLIST_URL} target="_blank">
Join waitlist
</a>
</div>

<div className="plan">
<b>Family</b>
<div>$15 / mo</div>
<a className="btnLink" href={WAITLIST_URL} target="_blank">
Join waitlist
</a>
</div>

<div className="plan">
<b>School Pilot</b>
<div>Custom</div>
<a className="btnLink" href={WAITLIST_URL} target="_blank">
Request pilot
</a>
</div>

</div>

</div>
</div>
</>
);
}
