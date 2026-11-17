export interface HomeAssumptions {
  capLowBasisPoints: number;
  capHighBasisPoints: number;
  costsLowMinor: number;
  costsHighMinor: number;
  rateLowBasisPoints: number;
  rateHighBasisPoints: number;
  years: number;
  cashMinor: number;
  purchaseCostsBasisPoints: number;
  otherDebtMinor: number;
}
export const defaultHomeAssumptions: HomeAssumptions = {
  capLowBasisPoints: 3000,
  capHighBasisPoints: 3500,
  costsLowMinor: 35000,
  costsHighMinor: 50000,
  rateLowBasisPoints: 300,
  rateHighBasisPoints: 500,
  years: 30,
  cashMinor: 0,
  purchaseCostsBasisPoints: 1000,
  otherDebtMinor: 0,
};
export function loanPrincipal(
  paymentMinor: number,
  annualRateBasisPoints: number,
  years: number,
): number {
  if (
    !Number.isSafeInteger(paymentMinor) ||
    paymentMinor < 0 ||
    !Number.isSafeInteger(annualRateBasisPoints) ||
    annualRateBasisPoints < 0 ||
    annualRateBasisPoints > 2500 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 50
  )
    throw new Error(
      'Choose a valid payment, interest rate (0–25%) and term (1–50 years).',
    );
  const months = years * 12;
  const rate = annualRateBasisPoints / 10000 / 12;
  return Math.floor(
    paymentMinor *
      (rate === 0 ? months : -Math.expm1(-months * Math.log1p(rate)) / rate),
  );
}
export function homeAffordability(incomeMinor: number, a: HomeAssumptions) {
  if (
    !Number.isSafeInteger(incomeMinor) ||
    incomeMinor < 0 ||
    incomeMinor > 100000000 ||
    [
      a.capLowBasisPoints,
      a.capHighBasisPoints,
      a.costsLowMinor,
      a.costsHighMinor,
      a.rateLowBasisPoints,
      a.rateHighBasisPoints,
      a.cashMinor,
      a.purchaseCostsBasisPoints,
      a.otherDebtMinor,
    ].some((n) => !Number.isSafeInteger(n) || n < 0) ||
    a.capLowBasisPoints > a.capHighBasisPoints ||
    a.capHighBasisPoints > 10000 ||
    a.costsLowMinor > a.costsHighMinor ||
    a.rateLowBasisPoints > a.rateHighBasisPoints ||
    a.rateHighBasisPoints > 2500 ||
    a.purchaseCostsBasisPoints > 10000 ||
    [a.costsLowMinor, a.costsHighMinor, a.cashMinor, a.otherDebtMinor].some(
      (n) => n > 100000000,
    )
  )
    throw new Error(
      'Check the scenario ranges: minimum must not exceed maximum.',
    );
  const lowPayment = Math.max(
    0,
    Math.floor((incomeMinor * a.capLowBasisPoints) / 10000) -
      a.costsHighMinor -
      a.otherDebtMinor,
  );
  const highPayment = Math.max(
    0,
    Math.floor((incomeMinor * a.capHighBasisPoints) / 10000) -
      a.costsLowMinor -
      a.otherDebtMinor,
  );
  const scenario = (paymentMinor: number, rate: number) => {
    const loanMinor = loanPrincipal(paymentMinor, rate, a.years);
    const priceMinor = Math.floor(
      (loanMinor + a.cashMinor) / (1 + a.purchaseCostsBasisPoints / 10000),
    );
    return { paymentMinor, loanMinor, priceMinor };
  };
  const low = scenario(lowPayment, a.rateHighBasisPoints);
  const high = scenario(highPayment, a.rateLowBasisPoints);
  const sensitivity = [];
  const count = a.rateHighBasisPoints === a.rateLowBasisPoints ? 0 : 4;
  for (let i = 0; i <= count; i++) {
    const rate = Math.round(
      a.rateLowBasisPoints +
        (a.rateHighBasisPoints - a.rateLowBasisPoints) *
          (count ? i / count : 0),
    );
    sensitivity.push({
      rate,
      low: scenario(lowPayment, rate),
      high: scenario(highPayment, rate),
    });
  }
  return { low, high, sensitivity };
}
