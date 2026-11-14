// StudySage AI engine — on-device, rule-based (extractive) AI.
// No external API, no model call, no API key. Everything runs locally.
// Method:
//  - sentence splitting + tokenisation
//  - keyword frequency (stopwords removed) -> sentence scores
//  - summary = top-scoring sentences, returned in original order
//  - flashcards = cloze + "What is X?" questions from key sentences
//  - quiz = MCQ (keyword distractors) + fill-in-the-blank from key sentences

const STOPWORDS = new Set(
  `a an the and or but if then else for of to in on at by with from as is are was were be been being has have had do does did will would can could should may might must this that these those it its their his her our your my we you they he she i am not no yes so such than too very just also only over under between into through after before when where which who whom what how why all any both each few more most other some such no nor not only own same so than too very can will just don should now one two three`.split(' ')
)

export function splitSentences(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.split(/\s+/).length >= 5)
}

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

export function extractKeywords(text, limit = 10) {
  const freq = new Map()
  for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1)
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function scoreSentences(sentences, freq) {
  return sentences.map((sentence, index) => {
    const words = tokenize(sentence)
    const freqScore = words.reduce((sum, w) => sum + (freq.get(w) || 0), 0)
    const avg = words.length ? freqScore / words.length : 0
    // Early sentences get a small position bonus; very long sentences are penalised.
    const positionBonus = index < 3 ? 0.5 : index < 8 ? 0.2 : 0
    const lengthPenalty = words.length > 35 ? 0.3 : 0
    return { sentence, index, score: avg + positionBonus - lengthPenalty }
  })
}

export function summarize(text, maxSentences = 5) {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []
  const freq = new Map()
  for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1)
  const scored = scoreSentences(sentences, freq)
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, Math.min(maxSentences, sentences.length))
  // Return in original reading order, so the summary reads like notes.
  return top.sort((a, b) => a.index - b.index).map((s) => s.sentence)
}

function keyTermIn(sentence, keywords) {
  // Longest keyword that appears as a whole word in the sentence.
  const lower = sentence.toLowerCase()
  return keywords
    .slice()
    .sort((a, b) => b.word.length - a.word.length)
    .find((k) => new RegExp(`\\b${k.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower))
}

export function makeFlashcards(text, limit = 8) {
  const sentences = splitSentences(text)
  const keywords = extractKeywords(text, 12)
  const freq = new Map()
  for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1)
  const scored = scoreSentences(sentences, freq).sort((a, b) => b.score - a.score)
  const cards = []
  const seen = new Set()
  for (const { sentence } of scored) {
    if (cards.length >= limit) break
    const term = keyTermIn(sentence, keywords)
    if (!term) continue
    const key = term.word
    if (seen.has(key)) continue
    seen.add(key)
    // Cloze card: hide the key term.
    const cloze = sentence.replace(new RegExp(`\\b${key}\\b`, 'i'), '______')
    // "What is X?" card for definition-style sentences ("X is ...").
    const isMatch = sentence.match(/^([A-Z][A-Za-z0-9 \-]{2,40}?)\s+(is|are|refers to|means)\b/i)
    if (isMatch && cloze !== sentence) {
      cards.push({
        id: `fc-${cards.length + 1}`,
        front: `What is ${isMatch[1].trim().charAt(0).toLowerCase() + isMatch[1].trim().slice(1)}?`,
        back: sentence,
        type: 'definition',
      })
    } else {
      cards.push({
        id: `fc-${cards.length + 1}`,
        front: cloze,
        back: sentence,
        type: 'cloze',
      })
    }
  }
  return cards
}

export function makeQuiz(text, limit = 6) {
  const sentences = splitSentences(text)
  const keywords = extractKeywords(text, 14)
  if (keywords.length < 4 || sentences.length === 0) return []
  const freq = new Map()
  for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1)
  const scored = scoreSentences(sentences, freq).sort((a, b) => b.score - a.score)
  const questions = []
  const usedTerms = new Set()
  const mcqCount = Math.ceil(limit / 2)

  for (const { sentence } of scored) {
    if (questions.length >= limit) break
    const term = keyTermIn(sentence, keywords)
    if (!term || usedTerms.has(term.word)) continue
    usedTerms.add(term.word)
    const blanked = sentence.replace(new RegExp(`\\b${term.word}\\b`, 'i'), '______')
    if (blanked === sentence) continue

    if (questions.length < mcqCount) {
      const distractors = shuffle(keywords.map((k) => k.word).filter((w) => w !== term.word)).slice(0, 3)
      if (distractors.length < 3) continue
      questions.push({
        id: `q-${questions.length + 1}`,
        type: 'mcq',
        question: `Which term fits the blank?\n"${blanked}"`,
        options: shuffle([term.word, ...distractors]),
        answer: term.word,
        explanation: sentence,
      })
    } else {
      questions.push({
        id: `q-${questions.length + 1}`,
        type: 'fill',
        question: `Fill in the blank:\n"${blanked}"`,
        answer: term.word,
        explanation: sentence,
      })
    }
  }
  return questions
}

export function analyze(text) {
  const clean = String(text || '').trim()
  if (clean.length < 100) {
    throw new Error('Please paste at least 100 characters of notes (a few sentences).')
  }
  const sentences = splitSentences(clean)
  const keywords = extractKeywords(clean, 10)
  return {
    stats: {
      characters: clean.length,
      words: clean.split(/\s+/).filter(Boolean).length,
      sentences: sentences.length,
    },
    summary: summarize(clean, 5),
    keywords,
    flashcards: makeFlashcards(clean, 8),
    quiz: makeQuiz(clean, 6),
    method: 'extractive, rule-based, on-device — sentence scoring by keyword frequency and position; no external AI API was called.',
  }
}
