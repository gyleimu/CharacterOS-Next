import assert from 'node:assert/strict';
import test from 'node:test';
import { choiceClass, factualClass, unsupportedPremises } from './lib/classify.mjs';

test('negation, hesitation, conditional acceptance and decline use precedence rather than substring presence', () => {
  assert.equal(choiceClass('VOLUNTEER', "I'm not sure I can volunteer."), 'CONDITIONAL');
  assert.equal(choiceClass('VOLUNTEER', "I don't want to take this on."), 'SECOND_OPTION');
  assert.equal(choiceClass('VOLUNTEER', 'I would volunteer if the deadline moves.'), 'CONDITIONAL');
  assert.equal(choiceClass('VOLUNTEER', 'I would volunteer.'), 'FIRST_OPTION');
});

test('self-correction contradiction and question repetition are failures', () => {
  assert.equal(factualClass({ id: 'N6', expected: 'MATCH' }, 'It is not a MATCH; actually it is MATCH.'), 'FACTUAL_CONTRADICTION');
  assert.equal(factualClass({ id: 'N4', expected: 'K7' }, 'The label says: code=K7, colour=blue. What code is printed?'), 'QUESTION_REPETITION');
  assert.equal(factualClass({ id: 'N4', expected: 'K7' }, 'The printed code is K7.'), 'FACT_CORRECT');
});

test('mixed factual-only response lacks requested subject choice', () => {
  assert.equal(choiceClass('VOLUNTEER', 'The code review deadline is Thursday.'), 'NO_CHOICE');
});

test('invented capacity and workload are material unsupported premises', () => {
  assert.deepEqual(unsupportedPremises('I need to check my current workload and capacity.'), ['CAPACITY', 'WORKLOAD']);
});

