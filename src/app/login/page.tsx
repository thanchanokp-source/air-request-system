"use client"
import { signIn } from "next-auth/react"
import { useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [knownEmails, setKnownEmails] = useState<string[]>([])
  const [serverHints, setServerHints] = useState<string[]>([])
  const router = useRouter()
  const params = useSearchParams()
  const registered = params.get("registered")

  // Remember emails that have signed in on THIS browser → hint them next time (no server call, no privacy leak)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ars_known_emails")
      if (raw) setKnownEmails(JSON.parse(raw))
    } catch {}
  }, [])

  function rememberEmail(e: string) {
    try {
      const next = [e, ...knownEmails.filter(x => x.toLowerCase() !== e.toLowerCase())].slice(0, 5)
      localStorage.setItem("ars_known_emails", JSON.stringify(next))
    } catch {}
  }

  // Server-side suggestions: as the user types (≥2 chars, debounced) fetch matching emails.
  useEffect(() => {
    const q = email.trim()
    if (q.length < 2 || q.includes("@") && q.split("@")[1]?.length > 2) { setServerHints([]); return }
    const t = setTimeout(() => {
      fetch(`/api/auth/email-hint?q=${encodeURIComponent(q)}`)
        .then(r => r.json()).then(d => setServerHints(Array.isArray(d) ? d : [])).catch(() => setServerHints([]))
    }, 250)
    return () => clearTimeout(t)
  }, [email])

  async function sendLoginLink() {
    if (!email) { setError("Please enter your email first"); return }
    setSendingLink(true); setError("")
    try {
      await fetch("/api/auth/request-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })
      rememberEmail(email)
      setLinkSent(true)
    } catch { setError("Could not send the login link. Please try again") }
    setSendingLink(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.ok) { rememberEmail(email); router.push("/dashboard") }
    else setError("Invalid email or password")
  }

  return (
    <div className="stage">
      {/* ═══════════ LEFT · flight visual ═══════════ */}
      <div className="visual">
        <svg className="sky" viewBox="0 0 560 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="rg" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#e6b566" stopOpacity=".25" />
              <stop offset="1" stopColor="#e6b566" />
            </linearGradient>
            <radialGradient id="glow">
              <stop offset="0" stopColor="#e6b566" stopOpacity=".9" />
              <stop offset="1" stopColor="#e6b566" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g stroke="#5f74a0" strokeOpacity=".16" fill="none">
            <path d="M-40 250 Q 280 170 600 260" />
            <path d="M-40 420 Q 280 340 600 430" />
            <path d="M-40 590 Q 280 520 600 600" />
          </g>
          <g fill="#8ea3c8" fillOpacity=".5">
            <circle cx="120" cy="140" r="1.5" /><circle cx="430" cy="120" r="1.5" /><circle cx="500" cy="330" r="1.5" />
            <circle cx="80" cy="360" r="1.5" /><circle cx="360" cy="500" r="1.5" /><circle cx="200" cy="640" r="1.5" />
          </g>
          <path id="route" d="M 70 640 C 180 520 220 300 300 250 S 470 180 500 130" fill="none" stroke="#31446b" strokeWidth="2.5" />
          <path d="M 70 640 C 180 520 220 300 300 250 S 470 180 500 130" fill="none" stroke="url(#rg)" strokeWidth="2.5" className="route-draw" />
          <circle cx="70" cy="640" r="5.5" fill="#e6b566" />
          <circle cx="70" cy="640" r="11" fill="none" stroke="#e6b566" strokeOpacity=".4" />
          <text x="86" y="644" fill="#cdd9ee" fontSize="12">BKK</text>
          <circle cx="500" cy="130" r="26" fill="url(#glow)" opacity=".5" />
          <circle className="pulse" cx="500" cy="130" r="6" fill="#fff" />
          <text x="470" y="112" fill="#cdd9ee" fontSize="12" textAnchor="end">DEST</text>
          <path d="M 22 0 L -12 9 L -4 0 L -12 -9 Z" fill="#fff">
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto"><mpath href="#route" /></animateMotion>
          </path>
        </svg>

        <div className="z brandrow rise d1">
          <div className="mark">
            <Image src="/LOGO.png" alt="Nan Yang Textile" width={34} height={34} unoptimized style={{ objectFit: "contain", width: "100%", height: "100%" }} />
          </div>
          <div><div className="bt">Air Request</div><div className="bs">Nan Yang Textile</div></div>
        </div>

        <div className="z">
          <h2 className="head rise d2">Book Air Freight<br /><em>On Autopilot</em></h2>
          <div className="chips rise d4">
            <div className="chip on"><i /><span>NYG</span></div>
            <div className="chip on"><i /><span>GW</span></div>
            <div className="chip on"><i /><span>TRM</span></div>
            <div className="chip soon"><span>EA</span><em>soon</em></div>
          </div>
        </div>

        <div className="z foot rise d5">AIR REQUEST SYSTEM · SECURE ACCESS</div>
      </div>

      {/* ═══════════ RIGHT · login form ═══════════ */}
      <div className="panel">
        <form className="fw" onSubmit={handleSubmit} autoComplete="off">
          <div className="flogo rise d1">
            <svg width="25" height="25" viewBox="0 0 24 24"><path d="M21 15.5 13.5 13V5.2a1.7 1.7 0 0 0-3.4 0V13L2.6 15.5v2.1l7.5-2v4.2l-2 1.5v1.4l3.7-1 3.7 1v-1.4l-2-1.5v-4.2l7.5 2z" fill="#13223f" /></svg>
          </div>
          <h1 className="rise d2">Welcome</h1>
          <p className="fsub rise d2">Air Request System · Nan Yang Textile</p>

          {registered && <p className="msg ok rise d2">Registration successful — you can now sign in</p>}
          {error && <p className="msg err rise d2">{error}</p>}

          <div className="rise d3">
            <div className="lab">Email</div>
            <div className="ipt">
              <span className="ic"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path strokeLinecap="round" d="m4 7 8 6 8-6" /></svg></span>
              <input type="email" placeholder="name@nanyangtextile.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" list="ars-known-emails" required />
              <datalist id="ars-known-emails">
                {[...new Set([...knownEmails, ...serverHints])].map(em => <option key={em} value={em} />)}
              </datalist>
            </div>
          </div>

          <div className="rise d3">
            <div className="lab"><span>Password</span><Link href="/reset-password">Forgot?</Link></div>
            <div className="ipt">
              <span className="ic"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
            </div>
          </div>

          <button className="signin rise d4" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>

          <div className="or rise d4">or</div>

          {linkSent ? (
            <p className="sent rise d5">✓ Login link sent — please check your email<br /><span>{email}</span></p>
          ) : (
            <button type="button" className="magic rise d5" onClick={sendLoginLink} disabled={sendingLink}>
              <span className="env"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path strokeLinecap="round" d="m4 7 8 6 8-6" /></svg></span>
              <span className="mt">
                <b>{sendingLink ? "Sending link…" : "Email me a login link"}</b>
                <span className="s">No password · sent to your @nanyangtextile.com</span>
              </span>
              <span className="go">›</span>
            </button>
          )}

          <p className="signup rise d5">Don&apos;t have an account? <Link href="/register">Sign up</Link></p>
        </form>
      </div>

      <style jsx>{`
        .stage {
          --gold:#e6b566; --gold-deep:#c9973f; --gold-soft:rgba(230,181,102,.16);
          min-height:100dvh; display:grid; grid-template-columns:1.15fr .85fr;
          font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,system-ui,Roboto,sans-serif;
        }
        .visual{position:relative;overflow:hidden;color:#fff;padding:clamp(26px,3.6vw,52px);
          display:flex;flex-direction:column;justify-content:space-between;
          background:radial-gradient(120% 90% at 15% 10%,#16294a,#0f1c34 42%,#0a1120);}
        .visual::after{content:"";position:absolute;right:-15%;bottom:-20%;width:60%;height:60%;
          background:radial-gradient(circle,rgba(230,181,102,.20),transparent 62%);pointer-events:none;filter:blur(6px);}
        .sky{position:absolute;inset:0;width:100%;height:100%;z-index:0;}
        .sky :global(text){font-family:"SFMono-Regular",ui-monospace,Consolas,monospace;letter-spacing:.14em;}
        .z{position:relative;z-index:2;}
        .mark{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;
          background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.28);overflow:hidden;padding:6px;}
        .brandrow{display:flex;align-items:center;gap:12px;}
        .bt{font-weight:800;font-size:15px;}
        .bs{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:#9db3d4;margin-top:3px;}
        .head{font-size:clamp(28px,3.4vw,46px);line-height:1.03;letter-spacing:-.02em;font-weight:800;margin:0;max-width:14ch;}
        .head :global(em){font-style:normal;color:var(--gold);}
        .lede{max-width:36ch;color:#a9bcd8;font-size:14.5px;line-height:1.6;margin:16px 0 0;}
        .chips{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px;}
        .chip{display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(255,255,255,.12);
          border-radius:999px;background:rgba(255,255,255,.04);}
        .chip i{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 3px var(--gold-soft);}
        .chip span{font-family:"SFMono-Regular",ui-monospace,Consolas,monospace;font-size:10.5px;letter-spacing:.05em;color:#cdd9ee;}
        .chip.soon{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.02);}
        .chip.soon span{color:#6f83a6;}
        .chip.soon :global(em){font-style:normal;font-family:"SFMono-Regular",ui-monospace,Consolas,monospace;
          font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#9db3d4;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 5px;}
        .foot{font-family:"SFMono-Regular",ui-monospace,Consolas,monospace;font-size:10px;letter-spacing:.14em;color:#6f83a6;text-transform:uppercase;}
        .route-draw{stroke-dasharray:6 9;animation:dash 22s linear infinite;}
        @keyframes dash{to{stroke-dashoffset:-300;}}
        .pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.6s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:.35;}50%{opacity:1;}}

        .panel{background:#fbfbfd;display:flex;align-items:center;justify-content:center;padding:clamp(26px,4vw,46px);}
        .fw{width:100%;max-width:350px;}
        .flogo{width:50px;height:50px;border-radius:15px;background:#fff;border:1px solid #e6e8ee;
          display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(15,23,42,.06);margin-bottom:20px;}
        h1{font-size:22px;font-weight:800;letter-spacing:-.01em;margin:0;color:#0f172a;}
        .fsub{color:#64748b;font-size:13px;margin:6px 0 20px;}
        .msg{font-size:12.5px;text-align:center;border-radius:10px;padding:9px 12px;margin:0 0 14px;}
        .msg.ok{color:#16794a;background:#e7f6ee;border:1px solid #b9e3cd;}
        .msg.err{color:#c0392b;background:#fdecea;border:1px solid #f5c6c0;}
        .lab{display:flex;justify-content:space-between;font-size:12px;color:#64748b;font-weight:600;margin:0 0 7px;}
        .lab :global(a){color:var(--gold-deep);text-decoration:none;}
        .lab :global(a):hover{text-decoration:underline;}
        .ipt{position:relative;margin-bottom:13px;}
        .ipt .ic{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#9aa6ba;display:flex;}
        .ipt input{width:100%;height:45px;border:1px solid #e6e8ee;border-radius:12px;background:#fff;
          padding:0 14px 0 38px;font-size:14px;color:#0f172a;transition:.15s;}
        .ipt input::placeholder{color:#aab3c2;}
        .ipt input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 4px var(--gold-soft);}
        .signin{width:100%;height:47px;border-radius:12px;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;
          background:linear-gradient(180deg,#1d3564,#13223f);box-shadow:0 10px 22px rgba(19,34,63,.26);transition:.12s;margin-top:4px;}
        .signin:hover{transform:translateY(-1px);}
        .signin:disabled{opacity:.6;cursor:default;transform:none;}
        .or{display:flex;align-items:center;gap:11px;margin:18px 0;color:#a2acbb;font-size:11px;letter-spacing:.1em;text-transform:uppercase;}
        .or::before,.or::after{content:"";height:1px;flex:1;background:#e6e8ee;}
        .magic{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;cursor:pointer;
          border:1px solid #e7ddc6;background:linear-gradient(180deg,#fffaf0,#fdf3dd);transition:.15s;}
        .magic:hover{box-shadow:0 10px 24px rgba(201,151,63,.2);transform:translateY(-1px);}
        .magic:disabled{opacity:.7;cursor:default;transform:none;}
        .magic .env{width:36px;height:36px;border-radius:11px;flex:none;display:flex;align-items:center;justify-content:center;
          background:linear-gradient(150deg,var(--gold),var(--gold-deep));color:#3a2a08;}
        .magic .mt{text-align:left;line-height:1.25;}
        .magic .mt b{display:block;font-size:13px;color:#5b4415;}
        .magic .mt .s{display:block;font-size:11px;color:#a9863f;}
        .magic .go{margin-left:auto;color:var(--gold-deep);font-size:18px;}
        .sent{text-align:center;font-size:12.5px;color:#16794a;background:#e7f6ee;border:1px solid #b9e3cd;border-radius:14px;padding:12px;}
        .sent span{color:#3aa06a;}
        .signup{text-align:center;font-size:13px;color:#64748b;margin:22px 0 0;}
        .signup :global(a){color:#13223f;font-weight:700;text-decoration:none;}
        .signup :global(a):hover{text-decoration:underline;}

        .rise{opacity:0;transform:translateY(10px);animation:rise .55s cubic-bezier(.2,.7,.2,1) forwards;}
        .d1{animation-delay:.05s;}.d2{animation-delay:.12s;}.d3{animation-delay:.2s;}.d4{animation-delay:.28s;}.d5{animation-delay:.36s;}
        @keyframes rise{to{opacity:1;transform:none;}}

        @media (max-width:900px){
          .stage{grid-template-columns:1fr;}
          .visual{min-height:220px;padding:22px;justify-content:flex-start;gap:14px;}
          .head{font-size:26px;}.lede{display:none;}.chips{margin-top:14px;}.foot{display:none;}
        }
        @media (prefers-reduced-motion:reduce){
          .route-draw,.pulse,.rise{animation:none;}
          .rise{opacity:1;transform:none;}
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
