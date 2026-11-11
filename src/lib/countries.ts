export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  IN: "India",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  CH: "Switzerland",
  JP: "Japan",
  SG: "Singapore",
  AE: "United Arab Emirates",
};

export function formatCountryName(code: string): string {
  const upper = code.trim().toUpperCase();
  const label = COUNTRY_NAMES[upper];
  return label ? `${label} (${upper})` : upper;
}
