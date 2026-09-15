import { useMemo, useState } from 'react';
import { calculateRefinance, encodeState, decodeState, State } from './refinance';
import { CURRENCIES, guessCurrency, money } from './intl';

const DEFAULT_STATE: State = {
  balance: 300000,
  currentRate: 7,
  remainingYears: 25,
  newRate: 5.5,
  newTermYears: 30,
  closingCosts: 5000,
  cashOut: 0,
  financeCosts: false,
  currency: guessCurrency(),
};

function readInitialState(): State {
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) return DEFAULT_STATE;
  return decodeState(params, DEFAULT_STATE);
}

function NumberField({ label, value, onChange, step = 1, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </label>
  );
}

export default function App() {
  const initial = useMemo(readInitialState, []);
  const [state, setState] = useState<State>(initial);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof State>(key: K, value: State[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const result = useMemo(() => calculateRefinance({
    currentBalance: state.balance,
    currentRatePct: state.currentRate,
    remainingYears: state.remainingYears,
    newRatePct: state.newRate,
    newTermYears: state.newTermYears,
    closingCosts: state.closingCosts,
    cashOutAmount: state.cashOut,
    financeClosingCosts: state.financeCosts,
  }), [state]);

  async function shareLink() {
    const params = encodeState(state);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', `?${params.toString()}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const verdict = result.breakevenMonths === null
    ? 'worse'
    : result.monthlySavings <= 0
      ? 'neutral'
      : 'better';

  return (
    <main className="page">
      <h1>Mortgage Refinance Calculator</h1>
      <p className="lede">
        Compare your current mortgage to a refinance offer: the new monthly payment, how many months
        it takes to recoup the closing costs, and whether it actually saves interest over the life of the loan.
      </p>

      <section className="panel">
        <h2>Currency</h2>
        <select value={state.currency} onChange={(e) => set('currency', e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </section>

      <div className="cols">
        <section className="panel">
          <h2>Your current loan</h2>
          <NumberField label="Remaining balance" value={state.balance} onChange={(v) => set('balance', v)} step={1000} />
          <NumberField label="Current interest rate" value={state.currentRate} onChange={(v) => set('currentRate', v)} step={0.05} suffix="%" />
          <NumberField label="Years remaining" value={state.remainingYears} onChange={(v) => set('remainingYears', v)} step={1} suffix="yrs" />
        </section>

        <section className="panel">
          <h2>Refinance offer</h2>
          <NumberField label="New interest rate" value={state.newRate} onChange={(v) => set('newRate', v)} step={0.05} suffix="%" />
          <NumberField label="New loan term" value={state.newTermYears} onChange={(v) => set('newTermYears', v)} step={1} suffix="yrs" />
          <NumberField label="Closing costs / fees" value={state.closingCosts} onChange={(v) => set('closingCosts', v)} step={100} />
          <label className="checkbox-row">
            <input type="checkbox" checked={state.financeCosts} onChange={(e) => set('financeCosts', e.target.checked)} />
            <span>Roll closing costs into the new loan instead of paying upfront</span>
          </label>
          <NumberField label="Cash-out amount (optional)" value={state.cashOut} onChange={(v) => set('cashOut', v)} step={1000} />
        </section>
      </div>

      <section className={`result ${verdict}`}>
        <div className="payment-row">
          <div>
            <div className="big-label">Current payment</div>
            <div className="big-num">{money(result.currentPayment, state.currency)}/mo</div>
          </div>
          <div className="arrow">&rarr;</div>
          <div>
            <div className="big-label">New payment</div>
            <div className="big-num">{money(result.newPayment, state.currency)}/mo</div>
          </div>
        </div>

        <p className="verdict-line">
          {result.monthlySavings > 0
            ? <>Saves <strong>{money(result.monthlySavings, state.currency)}/month</strong>.</>
            : result.monthlySavings < 0
              ? <>Costs <strong>{money(-result.monthlySavings, state.currency)}/month more</strong>.</>
              : <>No change to your monthly payment.</>}
          {' '}
          {result.breakevenMonths === null
            ? 'This refinance never recoups its closing costs.'
            : result.breakevenMonths === 0
              ? 'Breaks even immediately (no out-of-pocket closing costs).'
              : <>Breaks even in <strong>{result.breakevenMonths.toFixed(1)} months</strong> ({(result.breakevenMonths / 12).toFixed(1)} years).</>}
        </p>

        <div className="interest-compare">
          <div>
            <div className="small-label">Remaining interest, current loan</div>
            <div className="mid-num">{money(result.totalInterestCurrent, state.currency)}</div>
          </div>
          <div>
            <div className="small-label">Total interest, new loan</div>
            <div className="mid-num">{money(result.totalInterestNew, state.currency)}</div>
          </div>
        </div>
        <p className="delta-line">
          {result.lifetimeInterestDelta > 0
            ? <>Refinancing adds <strong>{money(result.lifetimeInterestDelta, state.currency)}</strong> in lifetime interest overall — often because the new term resets the clock, even though the monthly payment looks lower.</>
            : result.lifetimeInterestDelta < 0
              ? <>Refinancing saves <strong>{money(-result.lifetimeInterestDelta, state.currency)}</strong> in lifetime interest overall.</>
              : <>No change to total lifetime interest.</>}
        </p>

        <button className="share-btn" onClick={shareLink}>{copied ? 'Copied!' : 'Copy share link'}</button>
      </section>

      <section className="explainer">
        <h2>How this works</h2>
        <p>
          Your current payment is computed as if your remaining balance were a fresh loan amortized
          over your remaining years at your current rate — mathematically identical to your real
          payment, since a fixed-rate mortgage's remaining balance always amortizes this way. The new
          payment does the same for the refinance offer. Breakeven is simply closing costs divided by
          the monthly savings; if you roll the costs into the loan there's nothing to recoup out of
          pocket, so breakeven is immediate (though the loan itself is a little larger).
        </p>
        <h2>Frequently asked questions</h2>
        <h3>Why would refinancing to a lower payment ever cost more overall?</h3>
        <p>
          If the new loan resets the clock to a longer term — say, 15 years remaining stretched back
          out to a fresh 30 — you pay interest for far more months, which can outweigh a lower rate.
          This calculator's lifetime interest comparison exists specifically to catch that.
        </p>
        <h3>What counts as "breakeven"?</h3>
        <p>
          The point where your accumulated monthly savings equal what you paid in closing costs. Stay
          in the home past that point and the refinance was worth it on cash flow; leave sooner and
          it wasn't.
        </p>
        <h3>Is this financial advice?</h3>
        <p>
          No — it's a calculator for comparing the numbers you enter. Always get a real Loan Estimate
          from a lender before deciding, since taxes, insurance, PMI and points can all affect the
          real comparison.
        </p>
      </section>
    </main>
  );
}
