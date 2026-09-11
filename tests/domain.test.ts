import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalizeCode, validateJoin, validateChapters, nextPhase, average } from '../src/domain';

test('entrada exige código completo e um apelido válido', () => {
  assert.equal(normalizeCode(' ab-c234 '), 'ABC234');
  assert.equal(validateJoin('ABC234', ' Marina '), null);
  assert.ok(validateJoin('ABC', 'Marina'));
  assert.ok(validateJoin('ABC234', ' '));
  assert.ok(validateJoin('ABC234', 'a'.repeat(25)));
});
test('capítulos não aceitam NaN, fração, valores invertidos ou zero', () => {
  assert.equal(validateChapters(1, 12), null);
  for (const [start, end] of [[NaN, 12], [0, 2], [3, 2], [1, 2.5], [1, 2001]]) assert.ok(validateChapters(start, end));
});
test('a última pergunta também passa pela avaliação antes do encerramento', () => {
  assert.equal(nextPhase('lobby', 0, 3), 'discussion');
  assert.equal(nextPhase('discussion', 2, 3), 'rating');
  assert.equal(nextPhase('rating', 1, 3), 'discussion');
  assert.equal(nextPhase('rating', 2, 3), 'finished');
  assert.equal(nextPhase('finished', 2, 3), 'finished');
});
test('média trata ausência de votos e votos parciais', () => {
  assert.equal(average([]), 0);
  assert.equal(average([{ stars: 4 }, { stars: 5 }]), 4.5);
});
