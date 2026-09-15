export interface RefinanceInput {
  currentBalance: number;
  currentRatePct: number;
  remainingYears: number;
  newRatePct: number;
  newTermYears: number;
  closingCosts: number;
  cashOutAmount: number;
  financeClosingCosts: boolean;
}

export interface RefinanceResult {
  currentPayment: number;
  newPayment: number;
  monthlySavings: number;
  newPrincipal: number;
  breakevenMonths: number | null; // null = never recoups the closing costs
  totalInterestCurrent: number;
  totalInterestNew: number;
  lifetimeInterestDelta: number; // positive = refinancing costs more interest overall
}

// Standard fixed-rate amortizing payment. A loan's payment for its remaining
// balance amortized over its remaining term at its existing rate is
// mathematically identical to a fresh loan of that size/term/rate, so this
// same formula gives both the current and the prospective new payment.
export function monthlyPayment(principal: number, annualRatePct: number, termYears: number): number {
  const n = termYears * 12;
  if (n <= 0) return principal;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function calculateRefinance(input: RefinanceInput): RefinanceResult {
  const currentPayment = monthlyPayment(input.currentBalance, input.currentRatePct, input.remainingYears);

  const newPrincipal = input.currentBalance + input.cashOutAmount + (input.financeClosingCosts ? input.closingCosts : 0);
  const newPayment = monthlyPayment(newPrincipal, input.newRatePct, input.newTermYears);

  const monthlySavings = currentPayment - newPayment;

  // Out-of-pocket closing costs are what you have to recoup via monthly
  // savings; financed costs are already inside newPrincipal/newPayment.
  const outOfPocketCosts = input.financeClosingCosts ? 0 : input.closingCosts;
  let breakevenMonths: number | null;
  if (outOfPocketCosts <= 0) breakevenMonths = 0;
  else if (monthlySavings <= 0) breakevenMonths = null;
  else breakevenMonths = outOfPocketCosts / monthlySavings;

  const totalInterestCurrent = currentPayment * (input.remainingYears * 12) - input.currentBalance;
  const totalInterestNew = newPayment * (input.newTermYears * 12) - newPrincipal;

  return {
    currentPayment,
    newPayment,
    monthlySavings,
    newPrincipal,
    breakevenMonths,
    totalInterestCurrent,
    totalInterestNew,
    lifetimeInterestDelta: totalInterestNew - totalInterestCurrent,
  };
}

export interface State {
  balance: number;
  currentRate: number;
  remainingYears: number;
  newRate: number;
  newTermYears: number;
  closingCosts: number;
  cashOut: number;
  financeCosts: boolean;
  currency: string;
}

export function encodeState(s: State): URLSearchParams {
  const p = new URLSearchParams();
  p.set('b', String(s.balance));
  p.set('cr', String(s.currentRate));
  p.set('ry', String(s.remainingYears));
  p.set('nr', String(s.newRate));
  p.set('nt', String(s.newTermYears));
  p.set('cc', String(s.closingCosts));
  p.set('co', String(s.cashOut));
  p.set('fc', s.financeCosts ? '1' : '0');
  p.set('c', s.currency);
  return p;
}

function num(params: URLSearchParams, key: string, fallback: number): number {
  const v = params.get(key);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function decodeState(params: URLSearchParams, fallback: State): State {
  return {
    balance: num(params, 'b', fallback.balance),
    currentRate: num(params, 'cr', fallback.currentRate),
    remainingYears: num(params, 'ry', fallback.remainingYears),
    newRate: num(params, 'nr', fallback.newRate),
    newTermYears: num(params, 'nt', fallback.newTermYears),
    closingCosts: num(params, 'cc', fallback.closingCosts),
    cashOut: num(params, 'co', fallback.cashOut),
    financeCosts: params.has('fc') ? params.get('fc') === '1' : fallback.financeCosts,
    currency: params.get('c') ?? fallback.currency,
  };
}
