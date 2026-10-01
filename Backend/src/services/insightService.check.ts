import assert from 'node:assert/strict';
import { validateInsightEvidence } from './insightService.js';

const messages = [
  { role: 'user' as const, content: 'Saya paham kekhawatiran budget Anda. Mari mulai dengan pilot 30 hari.' },
  { role: 'assistant' as const, content: 'Baik, saya tertarik.' },
];
const report = validateInsightEvidence({
  totalScore: 80,
  outcome: 'follow_up',
  narrative: '',
  recommendations: [],
  evaluationSource: 'ai',
  categoryScores: [{ category: 'Discovery', weight: 100, score: 80, comment: '', examples: ['Saya paham kekhawatiran budget Anda.', 'Customer menyukai harganya.'] }],
  keyMoments: [
    { turn: 1, type: 'strength', description: '', salesMessage: 'Mari mulai dengan pilot 30 hari.' },
    { turn: 1, type: 'weakness', description: '', salesMessage: 'Customer menyukai harganya.' },
    { turn: 2, type: 'strength', description: '', salesMessage: 'Saya paham kekhawatiran budget Anda.' },
  ],
}, messages as Parameters<typeof validateInsightEvidence>[1]);

assert.deepEqual(report.categoryScores[0].examples, ['Saya paham kekhawatiran budget Anda.']);
assert.equal(report.keyMoments.length, 1);
