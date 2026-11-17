export const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    value / 100,
  );
export function SignedMoney({
  value,
  testId,
  label,
}: {
  value: number;
  testId?: string;
  label?: string;
}) {
  const text =
    value > 0
      ? `+${formatMoney(value)}`
      : value < 0
        ? `−${formatMoney(-value)}`
        : formatMoney(0);
  return (
    <strong
      data-testid={testId}
      className={`signed-amount ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`}
      aria-label={label ? `${label}: ${text}` : undefined}
    >
      {text}
    </strong>
  );
}
