// Client-side fallback for the same rule-based engine as server/ai.js.
// Used only if the /api/analyze request fails (e.g. preview without the
// Express server). No external API, no key — everything runs in the browser.
export interface Keyword { word: string; count: number }
export interface Flashcard { id: string; front: string; back: string; type: string }
export interface QuizQuestion { id: string; type: 'mcq' | 'fill'; question: string; options?: string[]; answer: string; explanation: string }
export interface Analysis {
  stats: { characters: number; words: number; sentences: number }
  summary: string[]
  keywords: Keyword[]
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
  method: string
}

const STOPWORDS = new Set(
  `a an the and or but if then else for of to in on at by with from as is are was were be been being has have had do does did will would can could should may might must this that these those it its their his her our your my we you they he she i am not no yes so such than too very just also only over under between into through after before when where which who whom what how why all any both each few more most other some such no nor not only own same so than too very can will just don should now one two three`.split(' ')
)

function splitSentences(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/).map((s) => s.trim())
    .filter((s) => s.length > 25 && s.split(/\s+/).length >= 5)
}
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, '')).filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}
function extractKeywords(text: string, limit = 10): Keyword[] {
  const freq = new Map<string, number>()
  for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1)
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit).map(([word, count]) => ({ word, count }))
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
function scoreSentences(sentences: string[], freq: Map<string, number>) {
  return sentences.map((sentence, index) => {
    const words = tokenize(sentence)
    const avg = words.length ? words.reduce((s, w) => s + (freq.get(w) || 0), 0) / words.length : 0
    return { sentence, index, score: avg + (index < 3 ? 0.5 : index < 8 ? 0.2 : 0) - (words.length > 35 ? 0.3 : 0) }
  })
}
function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

export function analyzeLocally(text: string): Analysis {
  const clean = text.trim()
  if (clean.length < 100) throw new Error('Please paste at least 100 characters of notes (a few sentences).')
  const sentences = splitSentences(clean)
  const keywords = extractKeywords(clean, 10)
  const freq = new Map<string, number>()
  for (const w of tokenize(clean)) freq.set(w, (freq.get(w) || 0) + 1)
  const scored = scoreSentences(sentences, freq)
  const summary = [...scored].sort((a, b) => b.score - a.score).slice(0, Math.min(5, sentences.length))
    .sort((a, b) => a.index - b.index).map((s) => s.sentence)

  const flashcards: Flashcard[] = []
  const seen = new Set<string>()
  const topKeywords = extractKeywords(clean, 12)
  for (const { sentence } of [...scored].sort((a, b) => b.score - a.score)) {
    if (flashcards.length >= 8) break
    const term = [...topKeywords].sort((a, b) => b.word.length - a.word.length)
      .find((k) => new RegExp(`\\b${escapeReg(k.word)}\\b`, 'i').test(sentence))
    if (!term || seen.has(term.word)) continue
    seen.add(term.word)
    const cloze = sentence.replace(new RegExp(`\\b${escapeReg(term.word)}\\b`, 'i'), '______')
    const m = sentence.match(/^([A-Z][A-Za-z0-9 \-]{2,40}?)\s+(is|are|refers to|means)\b/i)
    flashcards.push(m && cloze !== sentence
      ? { id: `fc-${flashcards.length + 1}`, front: `What is ${m[1].trim().charAt(0).toLowerCase() + m[1].trim().slice(1)}?`, back: sentence, type: 'definition' }
      : { id: `fc-${flashcards.length + 1}`, front: cloze, back: sentence, type: 'cloze' })
  }

  const quiz: QuizQuestion[] = []
  const used = new Set<string>()
  const allKeywords = extractKeywords(clean, 14)
  for (const { sentence } of [...scored].sort((a, b) => b.score - a.score)) {
    if (quiz.length >= 6) break
    const term = [...allKeywords].sort((a, b) => b.word.length - a.word.length)
      .find((k) => new RegExp(`\\b${escapeReg(k.word)}\\b`, 'i').test(sentence))
    if (!term || used.has(term.word)) continue
    used.add(term.word)
    const blanked = sentence.replace(new RegExp(`\\b${escapeReg(term.word)}\\b`, 'i'), '______')
    if (blanked === sentence) continue
    if (quiz.length < 3) {
      const distractors = shuffle(allKeywords.map((k) => k.word).filter((w) => w !== term.word)).slice(0, 3)
      if (distractors.length < 3) continue
      quiz.push({ id: `q-${quiz.length + 1}`, type: 'mcq', question: `Which term fits the blank?\n"${blanked}"`, options: shuffle([term.word, ...distractors]), answer: term.word, explanation: sentence })
    } else {
      quiz.push({ id: `q-${quiz.length + 1}`, type: 'fill', question: `Fill in the blank:\n"${blanked}"`, options: undefined, answer: term.word, explanation: sentence })
    }
  }

  return {
    stats: { characters: clean.length, words: clean.split(/\s+/).filter(Boolean).length, sentences: sentences.length },
    summary, keywords, flashcards, quiz,
    method: 'extractive, rule-based, on-device — sentence scoring by keyword frequency and position; no external AI API was called.',
  }
}
