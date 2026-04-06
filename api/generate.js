const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VocabWordSchema = z.object({
  word: z.string(),
  translation: z.string(),
  type: z.string(),
  gender_plural: z.string(),
  examples: z.array(z.string()).length(2),
  b2_note: z.string(),
});

const QuestionSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const EssayResponseSchema = z.object({
  essay: z.string(),
  vocabulary: z.array(VocabWordSchema),
  questions: z.array(QuestionSchema),
  grammar_notes: z.array(z.string()),
  translation: z.string(),
});

const TOPIC_LABELS = {
  environment: 'Umwelt und Gesellschaft',
  technology: 'Technologie und Wissenschaft',
  politics: 'Politik und Wirtschaft',
  education: 'Bildung und Gesundheit',
};

const DIFFICULTY_LABELS = {
  b1: 'B1',
  b2_standard: 'B2 Standard',
  b2_hard: 'B2 Schwer',
  c1: 'C1',
};

const LENGTH_WORDS = {
  short: '200-300',
  medium: '400-500',
  long: '600-800',
};

function buildPrompt(topic, difficulty, length) {
  const topicLabel = TOPIC_LABELS[topic] || topic;
  const difficultyLabel = DIFFICULTY_LABELS[difficulty] || difficulty;
  const wordRange = LENGTH_WORDS[length] || '400-500';

  return `You are a German language teacher creating study materials for learners preparing for the B2 exam.

Generate a German essay on the topic "${topicLabel}" at ${difficultyLabel} level (approximately ${wordRange} words).

Requirements:
- Write an authentic, well-structured German essay appropriate for the difficulty level
- Use varied vocabulary and grammatical structures appropriate to ${difficultyLabel}
- Include B2-level vocabulary that learners should know
- Select 8-12 important vocabulary words from the essay for the vocabulary list
- Each vocabulary word must appear EXACTLY as written in the essay text (same form/case)
- Generate 3-5 comprehension questions with detailed answers
- Note 2-4 interesting grammar constructions used in the essay
- Provide a natural English translation of the entire essay

For vocabulary words:
- Choose words that are genuinely useful for B2 learners
- Include the exact surface form as it appears in the essay
- For nouns: include article and plural form in gender_plural (e.g., "der Aufwand · Aufwände")
- For verbs: include infinitive in gender_plural (e.g., "→ aufwenden")
- For adjectives: include base form in gender_plural (e.g., "→ aufwendig")
- examples must be 2 different sentences, both different from any sentence in the essay
- b2_note should explain usage, register, or common contexts

Return a JSON object with this exact structure:
{
  "essay": "the full German essay text",
  "vocabulary": [
    {
      "word": "exact word as in essay",
      "translation": "English translation",
      "type": "noun|verb|adjective|adverb|conjunction|preposition|phrase",
      "gender_plural": "der Aufwand · Aufwände",
      "examples": ["example sentence 1 using the word", "example sentence 2 using the word"],
      "b2_note": "usage note for B2 learners"
    }
  ],
  "questions": [
    { "question": "German question?", "answer": "Detailed answer in German" }
  ],
  "grammar_notes": [
    "Description of grammar construction used"
  ],
  "translation": "Full English translation of the essay"
}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { topic, difficulty, length } = await readBody(req);

    const prompt = buildPrompt(topic, difficulty, length);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'text') textContent += block.text;
    }

    const jsonMatch =
      textContent.match(/```json\s*([\s\S]*?)```/) ||
      textContent.match(/```\s*([\s\S]*?)```/) ||
      textContent.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) throw new Error('No JSON found in response');

    const jsonStr = jsonMatch[1] || jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const cleaned = jsonStr.replace(/[\u0000-\u001F\u007F]/g, (ch) => {
        if (ch === '\n') return '\\n';
        if (ch === '\r') return '\\r';
        if (ch === '\t') return '\\t';
        return '';
      });
      parsed = JSON.parse(cleaned);
    }

    const result = EssayResponseSchema.parse(parsed);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error generating essay:', err);
    res.status(500).json({ error: err.message });
  }
};
