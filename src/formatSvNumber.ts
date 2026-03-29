/** Svensk talformatering (ISO/Språkrådet): tusentalsgrupp med mellanrum, decimal med komma. */

const svInt = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});

export function formatSvInteger(value: number): string {
  return svInt.format(value);
}

export function formatSvDecimal(
  value: number,
  minFractionDigits: number,
  maxFractionDigits: number
): string {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}
