# Mortgage Refinance Calculator

Should you refinance? Compares your current mortgage to a refinance offer:
new payment, breakeven month for closing costs, and whether it actually
saves interest over the life of the loan.

- Breakeven = closing costs ÷ monthly savings (or immediate if you roll
  costs into the new loan)
- Lifetime interest comparison catches the "lower payment, more total
  interest" trap of resetting to a longer term
- Optional cash-out amount
- 10 currencies, shareable link (`?b=&cr=&ry=&nr=&nt=&cc=&co=&fc=&c=`);
  nothing is uploaded, works offline
- Not financial advice — always get a real Loan Estimate from a lender

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types --test src/refinance.test.mjs
```

The engine (`monthlyPayment`, `calculateRefinance`) is in
`src/refinance.ts`. 12 Node tests in `src/refinance.test.mjs`.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://mortgage-refinance-calculator.correia95.workers.dev/>.
