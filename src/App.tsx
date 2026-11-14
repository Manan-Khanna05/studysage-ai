import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeLocally, type Analysis } from './lib/ai'
import { SAMPLE_NOTES } from './data/sampleNotes'
import './App.css'

type Tab = 'summary' | 'flashcards' | 'quiz' | 'timer'

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ } }

const MODES = [
  { id: 'focus', label: 'Focus', minutes: 25 },
  { id: 'short', label: 'Short break', minutes: 5 },
  { id: 'long', label: 'Long break', minutes: 15 },
] as const

export default function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'server' | 'local' | ''>('')
  const [tab, setTab] = useState<Tab>('summary')

  // Flashcards
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<string[]>(() => load('studysage-known', []))
  const [order, setOrder] = useState<number[]>([])

  // Quiz
  const [qIndex, setQIndex] = useState(0)
  const [picked, setPicked] = useState<string>('')
  const [fillAnswer, setFillAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [best, setBest] = useState<number>(() => load('studysage-best', 0))

  // Pomodoro
  const [mode, setMode] = useState<(typeof MODES)[number]>(MODES[0])
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState<number>(() => load('studysage-sessions', 0))
  const timerRef = useRef<number | null>(null)

  const words = useMemo(() => text.trim() ? text.trim().split(/\s+/).length : 0, [text])
  const cards = useMemo(() => {
    if (!result) return []
    const idx = order.length === result.flashcards.length ? order : result.flashcards.map((_, i) => i)
    return idx.map((i) => result.flashcards[i])
  }, [result, order])
  const currentCard = cards[cardIndex]

  useEffect(() => { save('studysage-known', known) }, [known])
  useEffect(() => { save('studysage-best', best) }, [best])
  useEffect(() => { save('studysage-sessions', sessions) }, [sessions])

  useEffect(() => {
    if (!running) return
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false)
          if (mode.id === 'focus') setSessions((n) => n + 1)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [running, mode])

  async function analyze() {
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Server unavailable — using on-device analysis.')
      const data = (await res.json()) as Analysis
      if ((data as unknown as { error?: string }).error) throw new Error((data as unknown as { error: string }).error)
      setResult(data); setSource('server')
    } catch {
      try {
        setResult(analyzeLocally(text)); setSource('local')
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not analyse these notes.') }
    } finally {
      setLoading(false)
      setTab('summary'); setCardIndex(0); setFlipped(false)
      setQIndex(0); setPicked(''); setFillAnswer(''); setChecked(false); setScore(0); setFinished(false)
    }
  }

  function loadFile(file: File) {
    file.text().then((t) => { setText(t); setError('') }).catch(() => setError('Could not read that file. Try a .txt or .md file.'))
  }

  function shuffleCards() {
    if (!result) return
    const idx = result.flashcards.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
    setOrder(idx); setCardIndex(0); setFlipped(false)
  }

  function markKnown(id: string, isKnown: boolean) {
    setKnown((prev) => isKnown ? [...new Set([...prev, id])] : prev.filter((x) => x !== id))
    setFlipped(false); setCardIndex((i) => Math.min(i + 1, Math.max(cards.length - 1, 0)))
  }

  function checkAnswer() {
    if (!result) return
    const q = result.quiz[qIndex]
    const correct = q.type === 'mcq'
      ? picked.trim().toLowerCase() === q.answer.toLowerCase()
      : fillAnswer.trim().toLowerCase() === q.answer.toLowerCase()
    if (correct) setScore((s) => s + 1)
    setChecked(true)
  }
  function nextQuestion() {
    if (!result) return
    if (qIndex + 1 >= result.quiz.length) {
      setFinished(true)
    } else {
      setQIndex((i) => i + 1); setPicked(''); setFillAnswer(''); setChecked(false)
    }
  }
  function isCurrentCorrect() {
    if (!result) return false
    const q = result.quiz[qIndex]
    return q.type === 'mcq'
      ? picked.trim().toLowerCase() === q.answer.toLowerCase()
      : fillAnswer.trim().toLowerCase() === q.answer.toLowerCase()
  }
  // Recompute best when finishing: score already includes the last answer.
  useEffect(() => { if (finished) setBest((b) => Math.max(b, score)) }, [finished, score])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="page">
      <header className="nav">
        <div className="nav-inner">
          <span className="logo">StudySage AI</span>
          <nav>
            <a href="#input">Notes</a>
            <a href="#results">Results</a>
            <a href="#timer">Timer</a>
          </nav>
          <span className="nav-note">On-device AI · No key needed</span>
        </div>
      </header>

      <main>
        <section className="hero">
          <h1>Learn smarter<br />from your notes.</h1>
          <p className="hero-sub">Paste lecture notes and StudySage turns them into a summary, flashcards and a quiz — in seconds.</p>
          <div className="hero-actions">
            <a className="btn-primary" href="#input">Start studying</a>
            <button className="btn-secondary" type="button" onClick={() => { setText(SAMPLE_NOTES); document.getElementById('input')?.scrollIntoView({ behavior: 'smooth' }) }}>
              Try sample DBMS notes
            </button>
          </div>
          <p className="hero-note">On-device, rule-based AI — no external API, no account, no key. Your notes never leave this page unless the local server is running.</p>
        </section>

        <section id="input" className="section">
          <div className="container">
            <h2>Your notes</h2>
            <p className="section-sub">Paste text, or upload a .txt / .md file. At least 100 characters — a few sentences is enough.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your lecture notes here…"
              rows={10}
              aria-label="Lecture notes"
            />
            <div className="input-row">
              <span className="count">{words} words · {text.length} characters</span>
              <label className="btn-secondary file-label">
                Upload .txt / .md
                <input type="file" accept=".txt,.md" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f) }} />
              </label>
              <button className="btn-secondary" type="button" onClick={() => setText(SAMPLE_NOTES)}>Try sample DBMS notes</button>
              <button className="btn-primary" type="button" onClick={analyze} disabled={loading || text.trim().length < 100}>
                {loading ? 'Analysing…' : 'Generate summary, flashcards & quiz'}
              </button>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            {result && (
              <p className="source-note">
                Analysed {source === 'server' ? 'by the local Express server' : 'on-device in your browser'} ·
                {result.stats.words} words · {result.stats.sentences} sentences · {result.keywords.length} key terms
              </p>
            )}
          </div>
        </section>

        {result && (
          <section id="results" className="section section-neutral">
            <div className="container">
              <h2>Your study pack</h2>
              <div className="tabs" role="tablist">
                {(['summary', 'flashcards', 'quiz', 'timer'] as Tab[]).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
                    {t === 'summary' ? 'Summary' : t === 'flashcards' ? `Flashcards (${result.flashcards.length})` : t === 'quiz' ? `Quiz (${result.quiz.length})` : 'Timer'}
                  </button>
                ))}
              </div>

              {tab === 'summary' && (
                <div className="card">
                  <h3>Summary</h3>
                  <ul className="summary-list">
                    {result.summary.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                  <h3>Key terms</h3>
                  <div className="chips">
                    {result.keywords.map((k) => <span className="chip" key={k.word}>{k.word} · {k.count}</span>)}
                  </div>
                  <p className="method">{result.method}</p>
                </div>
              )}

              {tab === 'flashcards' && currentCard && (
                <div>
                  <div className="card flashcard" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped((f) => !f) }}>
                    <span className="card-label">{flipped ? 'Answer' : 'Question'} · {cardIndex + 1} of {cards.length} · tap to flip</span>
                    <p className="flash-text">{flipped ? currentCard.back : currentCard.front}</p>
                    <span className="card-label">{currentCard.type === 'definition' ? 'Definition card' : 'Cloze card'}</span>
                  </div>
                  <div className="input-row">
                    <button className="btn-secondary" onClick={() => { setFlipped(false); setCardIndex((i) => Math.max(0, i - 1)) }} disabled={cardIndex === 0}>Previous</button>
                    <button className="btn-secondary" onClick={shuffleCards}>Shuffle</button>
                    <button className="btn-secondary" onClick={() => markKnown(currentCard.id, false)}>Still learning</button>
                    <button className="btn-primary" onClick={() => markKnown(currentCard.id, true)}>I know this</button>
                    <button className="btn-secondary" onClick={() => { setFlipped(false); setCardIndex((i) => Math.min(cards.length - 1, i + 1)) }} disabled={cardIndex >= cards.length - 1}>Next</button>
                  </div>
                  <p className="source-note">{known.length} of {result.flashcards.length} cards marked known · saved in your browser</p>
                </div>
              )}

              {tab === 'quiz' && result.quiz.length > 0 && (
                <div className="card">
                  {finished ? (
                    <div>
                      <h3>Quiz complete</h3>
                      <p className="score">You scored {score} out of {result.quiz.length}</p>
                      <p className="source-note">Best score on this device: {Math.max(best, score)} / {result.quiz.length}</p>
                      <h3>Review</h3>
                      <ul className="summary-list">
                        {result.quiz.map((q) => <li key={q.id}><strong>{q.answer}</strong> — {q.explanation}</li>)}
                      </ul>
                      <button className="btn-primary" onClick={() => { setQIndex(0); setScore(0); setFinished(false); setPicked(''); setFillAnswer(''); setChecked(false) }}>Retake quiz</button>
                    </div>
                  ) : (
                    <div>
                      <span className="card-label">Question {qIndex + 1} of {result.quiz.length} · Score {score}</span>
                      <p className="quiz-q">{result.quiz[qIndex].question}</p>
                      {result.quiz[qIndex].type === 'mcq' ? (
                        <div className="options">
                          {result.quiz[qIndex].options!.map((opt) => (
                            <button key={opt} className={picked === opt ? 'option selected' : 'option'} onClick={() => !checked && setPicked(opt)} disabled={checked}>{opt}</button>
                          ))}
                        </div>
                      ) : (
                        <input className="fill-input" value={fillAnswer} onChange={(e) => setFillAnswer(e.target.value)} placeholder="Type the missing term…" disabled={checked} aria-label="Fill-in answer" />
                      )}
                      {!checked ? (
                        <button className="btn-primary" onClick={checkAnswer} disabled={result.quiz[qIndex].type === 'mcq' ? !picked : !fillAnswer.trim()}>Check answer</button>
                      ) : (
                        <div>
                          <p className={isCurrentCorrect() ? 'correct' : 'wrong'}>{isCurrentCorrect() ? 'Correct.' : `Not quite — the answer is “${result.quiz[qIndex].answer}”.`}</p>
                          <p className="source-note">{result.quiz[qIndex].explanation}</p>
                          <button className="btn-primary" onClick={nextQuestion}>{qIndex + 1 >= result.quiz.length ? 'See results' : 'Next question'}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'timer' && (
                <div className="card timer-card">
                  <h3>Study timer</h3>
                  <div className="tabs">
                    {MODES.map((m) => (
                      <button key={m.id} className={mode.id === m.id ? 'tab active' : 'tab'} onClick={() => { setMode(m); setSecondsLeft(m.minutes * 60); setRunning(false) }}>{m.label}</button>
                    ))}
                  </div>
                  <p className="timer-display">{mm}:{ss}</p>
                  <div className="input-row">
                    <button className="btn-primary" onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Start'}</button>
                    <button className="btn-secondary" onClick={() => { setRunning(false); setSecondsLeft(mode.minutes * 60) }}>Reset</button>
                  </div>
                  <p className="source-note">{sessions} focus session{sessions === 1 ? '' : 's'} completed · saved in your browser</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section id="timer" className="section">
          <div className="container">
            <h2>Focus, in short sessions.</h2>
            <p className="section-sub">Analyse your notes first, then use the Pomodoro timer in the Results tab — 25 minutes of focus, 5 minutes of break. Progress is saved in localStorage on your device.</p>
            <button className="btn-primary" onClick={() => { setTab('timer'); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }) }}>Open the timer</button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>StudySage AI — by Manan Khanna, BE CSE, Chandigarh University.</p>
        <p>AI honesty: summaries, flashcards and quizzes are generated on-device by a rule-based extractive engine (keyword frequency + sentence position). No GPT, no OpenAI, no external API call, no API key.</p>
      </footer>
    </div>
  )
}
