require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VocabWordSchema = z.object({
  word: z.string(),
  translation: z.string(),
  type: z.string(),
  gender_plural: z.string(),
  example: z.string(),
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
      "example": "example sentence using the word",
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

async function generateEssay(topic, difficulty, length) {
  const prompt = buildPrompt(topic, difficulty, length);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'enabled', budget_tokens: 8000 },
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text content from response
  let textContent = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      textContent += block.text;
    }
  }

  // Parse JSON from response
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return EssayResponseSchema.parse(parsed);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { topic, difficulty, length } = JSON.parse(body);
        const result = await generateEssay(topic, difficulty, length);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Error generating essay:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`German Study App running at http://localhost:${PORT}`);
});
