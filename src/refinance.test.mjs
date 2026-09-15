import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyPayment, calculateRefinance, encodeState, decodeState } from './refinance.ts';

test('monthlyPayment matches the textbook worked example ($100k at 12%/30y)', () => {
  const payment = monthlyPayment(100000, 12, 30);
  assert.ok(Math.abs(payment - 1028.61) < 0.01);
});

test('monthlyPayment handles a 0% interest rate as a straight division', () => {
  const payment = monthlyPayment(120000, 0, 10);
  assert.ok(Math.abs(payment - 1000) < 1e-9);
});

test('calculateRefinance: lower rate with no closing costs breaks even instantly', () => {
  const result = calculateRefinance({
    currentBalance: 300000, currentRatePct: 7, remainingYears: 25,
    newRatePct: 5, newTermYears: 25,
    closingCosts: 0, cashOutAmount: 0, financeClosingCosts: false,
  });
  assert.ok(result.monthlySavings > 0, 'a lower rate at the same term should lower the payment');
  assert.equal(result.breakevenMonths, 0);
});

test('calculateRefinance: breakeven month is closing costs divided by monthly savings', () => {
  const result = calculateRefinance({
    currentBalance: 300000, currentRatePct: 7, remainingYears: 25,
    newRatePct: 5, newTermYears: 25,
    closingCosts: 6000, cashOutAmount: 0, financeClosingCosts: false,
  });
  const expected = 6000 / result.monthlySavings;
  assert.ok(Math.abs(result.breakevenMonths - expected) < 1e-9);
  assert.ok(result.breakevenMonths > 0);
});

test('calculateRefinance: a higher new payment never breaks even', () => {
  const result = calculateRefinance({
    currentBalance: 300000, currentRatePct: 4, remainingYears: 25,
    newRatePct: 7, newTermYears: 25,
    closingCosts: 5000, cashOutAmount: 0, financeClosingCosts: false,
  });
  assert.ok(result.monthlySavings < 0);
  assert.equal(result.breakevenMonths, null);
});

test('calculateRefinance: financing the closing costs rolls them into the new principal, not out-of-pocket breakeven', () => {
  const financed = calculateRefinance({
    currentBalance: 300000, currentRatePct: 7, remainingYears: 25,
    newRatePct: 5, newTermYears: 25,
    closingCosts: 6000, cashOutAmount: 0, financeClosingCosts: true,
  });
  assert.equal(financed.newPrincipal, 306000);
  assert.equal(financed.breakevenMonths, 0, 'nothing paid out of pocket, so breakeven is immediate');

  const outOfPocket = calculateRefinance({
    currentBalance: 300000, currentRatePct: 7, remainingYears: 25,
    newRatePct: 5, newTermYears: 25,
    closingCosts: 6000, cashOutAmount: 0, financeClosingCosts: false,
  });
  assert.equal(outOfPocket.newPrincipal, 300000);
  assert.ok(financed.newPayment > outOfPocket.newPayment, 'financing costs increases principal, and therefore the payment');
});

test('calculateRefinance: a cash-out amount increases the new principal by exactly that amount', () => {
  const noCashOut = calculateRefinance({
    currentBalance: 300000, currentRatePct: 6, remainingYears: 20,
    newRatePct: 6, newTermYears: 20,
    closingCosts: 0, cashOutAmount: 0, financeClosingCosts: false,
  });
  const withCashOut = calculateRefinance({
    currentBalance: 300000, currentRatePct: 6, remainingYears: 20,
    newRatePct: 6, newTermYears: 20,
    closingCosts: 0, cashOutAmount: 25000, financeClosingCosts: false,
  });
  assert.equal(withCashOut.newPrincipal - noCashOut.newPrincipal, 25000);
  assert.ok(withCashOut.newPayment > noCashOut.newPayment);
});

test('calculateRefinance: extending the term can lower the payment while increasing lifetime interest', () => {
  // Same rate, but stretching 15 remaining years back out to a fresh 30-year term.
  const result = calculateRefinance({
    currentBalance: 200000, currentRatePct: 6, remainingYears: 15,
    newRatePct: 6, newTermYears: 30,
    closingCosts: 0, cashOutAmount: 0, financeClosingCosts: false,
  });
  assert.ok(result.newPayment < result.currentPayment, 'stretching the term lowers the monthly payment');
  assert.ok(result.lifetimeInterestDelta > 0, 'but paying over twice as long costs more total interest, the classic refinance trap');
});

test('calculateRefinance: identical rate and term with real closing costs is strictly worse (fees with no benefit)', () => {
  const result = calculateRefinance({
    currentBalance: 250000, currentRatePct: 6, remainingYears: 20,
    newRatePct: 6, newTermYears: 20,
    closingCosts: 4000, cashOutAmount: 0, financeClosingCosts: false,
  });
  assert.ok(Math.abs(result.monthlySavings) < 1e-9);
  assert.equal(result.breakevenMonths, null, 'zero savings can never pay back a positive closing cost');
});

test('calculateRefinance: totalInterestCurrent matches a hand-computed sum for a simple case', () => {
  // $120,000 at 0% over 10 years: no interest at all, sanity-checks the formula.
  const result = calculateRefinance({
    currentBalance: 120000, currentRatePct: 0, remainingYears: 10,
    newRatePct: 0, newTermYears: 10,
    closingCosts: 0, cashOutAmount: 0, financeClosingCosts: false,
  });
  assert.ok(Math.abs(result.totalInterestCurrent) < 1e-6);
  assert.ok(Math.abs(result.totalInterestNew) < 1e-6);
});

test('encodeState / decodeState round-trip a full scenario', () => {
  const state = {
    balance: 275000, currentRate: 6.5, remainingYears: 22, newRate: 5.25,
    newTermYears: 30, closingCosts: 5500, cashOut: 10000, financeCosts: true, currency: 'AUD',
  };
  const decoded = decodeState(encodeState(state), state);
  assert.deepEqual(decoded, state);
});

test('decodeState falls back to defaults for missing/garbage params', () => {
  const fallback = {
    balance: 300000, currentRate: 7, remainingYears: 25, newRate: 5,
    newTermYears: 30, closingCosts: 5000, cashOut: 0, financeCosts: false, currency: 'USD',
  };
  const decoded = decodeState(new URLSearchParams('b=notanumber'), fallback);
  assert.deepEqual(decoded, fallback);
});
