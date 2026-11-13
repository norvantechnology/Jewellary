export interface CountryStateOption {
  code: string;
  name: string;
}

export interface CountryMetadata {
  code: string;
  name: string;
  dialCode: string;
  stateLabel: string;
  postalExample: string;
  postalHint: string;
  postalPattern?: RegExp;
  states?: readonly CountryStateOption[];
}

const US_STATES: readonly CountryStateOption[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const CA_PROVINCES: readonly CountryStateOption[] = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

const AU_STATES: readonly CountryStateOption[] = [
  { code: "ACT", name: "Australian Capital Territory" },
  { code: "NSW", name: "New South Wales" },
  { code: "NT", name: "Northern Territory" },
  { code: "QLD", name: "Queensland" },
  { code: "SA", name: "South Australia" },
  { code: "TAS", name: "Tasmania" },
  { code: "VIC", name: "Victoria" },
  { code: "WA", name: "Western Australia" },
];

const GB_REGIONS: readonly CountryStateOption[] = [
  { code: "ENG", name: "England" },
  { code: "SCT", name: "Scotland" },
  { code: "WLS", name: "Wales" },
  { code: "NIR", name: "Northern Ireland" },
];

const IN_STATES: readonly CountryStateOption[] = [
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "DL", name: "Delhi" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OD", name: "Odisha" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TS", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
];

const AE_EMIRATES: readonly CountryStateOption[] = [
  { code: "AZ", name: "Abu Dhabi" },
  { code: "AJ", name: "Ajman" },
  { code: "DU", name: "Dubai" },
  { code: "FU", name: "Fujairah" },
  { code: "RK", name: "Ras Al Khaimah" },
  { code: "SH", name: "Sharjah" },
  { code: "UQ", name: "Umm Al Quwain" },
];

export const COUNTRY_DIRECTORY: readonly CountryMetadata[] = [
  {
    code: "US",
    name: "United States",
    dialCode: "+1",
    stateLabel: "State",
    postalExample: "10013 or 10013-1234",
    postalHint: "5-digit ZIP code (or ZIP+4)",
    postalPattern: /^\d{5}(?:-\d{4})?$/,
    states: US_STATES,
  },
  {
    code: "CA",
    name: "Canada",
    dialCode: "+1",
    stateLabel: "Province / Territory",
    postalExample: "M5V 2T6",
    postalHint: "6-character Canadian postal code (e.g. M5V 2T6)",
    postalPattern: /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i,
    states: CA_PROVINCES,
  },
  {
    code: "GB",
    name: "United Kingdom",
    dialCode: "+44",
    stateLabel: "Country / Region",
    postalExample: "SW1A 1AA",
    postalHint: "UK postcode (e.g. SW1A 1AA)",
    postalPattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    states: GB_REGIONS,
  },
  {
    code: "AU",
    name: "Australia",
    dialCode: "+61",
    stateLabel: "State / Territory",
    postalExample: "2000",
    postalHint: "4-digit Australian postcode",
    postalPattern: /^\d{4}$/,
    states: AU_STATES,
  },
  {
    code: "IN",
    name: "India",
    dialCode: "+91",
    stateLabel: "State / UT",
    postalExample: "400001",
    postalHint: "6-digit PIN code",
    postalPattern: /^[1-9]\d{5}$/,
    states: IN_STATES,
  },
  {
    code: "FR",
    name: "France",
    dialCode: "+33",
    stateLabel: "Region / Department",
    postalExample: "75001",
    postalHint: "5-digit French postal code",
    postalPattern: /^\d{5}$/,
  },
  {
    code: "DE",
    name: "Germany",
    dialCode: "+49",
    stateLabel: "State (Bundesland)",
    postalExample: "10117",
    postalHint: "5-digit German Postleitzahl",
    postalPattern: /^\d{5}$/,
  },
  {
    code: "IT",
    name: "Italy",
    dialCode: "+39",
    stateLabel: "Province / Region",
    postalExample: "20121",
    postalHint: "5-digit Italian CAP code",
    postalPattern: /^\d{5}$/,
  },
  {
    code: "ES",
    name: "Spain",
    dialCode: "+34",
    stateLabel: "Province",
    postalExample: "28001",
    postalHint: "5-digit Spanish postal code",
    postalPattern: /^\d{5}$/,
  },
  {
    code: "CH",
    name: "Switzerland",
    dialCode: "+41",
    stateLabel: "Canton",
    postalExample: "1204",
    postalHint: "4-digit Swiss postal code",
    postalPattern: /^\d{4}$/,
  },
  {
    code: "NL",
    name: "Netherlands",
    dialCode: "+31",
    stateLabel: "Province",
    postalExample: "1012 JS",
    postalHint: "4 digits and 2 letters (e.g. 1012 JS)",
    postalPattern: /^\d{4}\s?[A-Z]{2}$/i,
  },
  {
    code: "BE",
    name: "Belgium",
    dialCode: "+32",
    stateLabel: "Province / Region",
    postalExample: "1000",
    postalHint: "4-digit Belgian postal code",
    postalPattern: /^\d{4}$/,
  },
  {
    code: "AT",
    name: "Austria",
    dialCode: "+43",
    stateLabel: "State",
    postalExample: "1010",
    postalHint: "4-digit Austrian postal code",
    postalPattern: /^\d{4}$/,
  },
  {
    code: "JP",
    name: "Japan",
    dialCode: "+81",
    stateLabel: "Prefecture",
    postalExample: "104-0061",
    postalHint: "7-digit postal code (e.g. 104-0061)",
    postalPattern: /^\d{3}-?\d{4}$/,
  },
  {
    code: "SG",
    name: "Singapore",
    dialCode: "+65",
    stateLabel: "District / Region",
    postalExample: "238801",
    postalHint: "6-digit Singapore postal code",
    postalPattern: /^\d{6}$/,
  },
  {
    code: "HK",
    name: "Hong Kong",
    dialCode: "+852",
    stateLabel: "District / Territory",
    postalExample: "Central (or N/A)",
    postalHint: "District or postal reference",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    dialCode: "+971",
    stateLabel: "Emirate",
    postalExample: "00000",
    postalHint: "P.O. Box or 00000",
    states: AE_EMIRATES,
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    dialCode: "+966",
    stateLabel: "Province",
    postalExample: "11564",
    postalHint: "5-digit Saudi postal code",
    postalPattern: /^\d{5}$/,
  },
  {
    code: "KW",
    name: "Kuwait",
    dialCode: "+965",
    stateLabel: "Governorate",
    postalExample: "13001",
    postalHint: "5-digit Kuwait postal code",
    postalPattern: /^\d{5}$/,
  },
  {
    code: "QA",
    name: "Qatar",
    dialCode: "+974",
    stateLabel: "Municipality",
    postalExample: "00000",
    postalHint: "P.O. Box or 00000",
  },
  {
    code: "IE",
    name: "Ireland",
    dialCode: "+353",
    stateLabel: "County",
    postalExample: "D02 X285",
    postalHint: "Eircode or county code",
    postalPattern: /^[A-Z\d]{3}\s?[A-Z\d]{4}$|^\d{2,6}$/i,
  },
  {
    code: "NZ",
    name: "New Zealand",
    dialCode: "+64",
    stateLabel: "Region",
    postalExample: "1010",
    postalHint: "4-digit New Zealand postcode",
    postalPattern: /^\d{4}$/,
  },
  {
    code: "SE",
    name: "Sweden",
    dialCode: "+46",
    stateLabel: "County",
    postalExample: "111 22",
    postalHint: "5-digit Swedish postal code",
    postalPattern: /^\d{3}\s?\d{2}$/,
  },
  {
    code: "NO",
    name: "Norway",
    dialCode: "+47",
    stateLabel: "County",
    postalExample: "0150",
    postalHint: "4-digit Norwegian postal code",
    postalPattern: /^\d{4}$/,
  },
  {
    code: "DK",
    name: "Denmark",
    dialCode: "+45",
    stateLabel: "Region",
    postalExample: "1050",
    postalHint: "4-digit Danish postal code",
    postalPattern: /^\d{4}$/,
  },
  {
    code: "KR",
    name: "South Korea",
    dialCode: "+82",
    stateLabel: "Province / Special City",
    postalExample: "04524",
    postalHint: "5-digit postal code",
    postalPattern: /^\d{5}$/,
  },
  {
    code: "ZA",
    name: "South Africa",
    dialCode: "+27",
    stateLabel: "Province",
    postalExample: "2196",
    postalHint: "4-digit South African postal code",
    postalPattern: /^\d{4}$/,
  },
  {
    code: "BR",
    name: "Brazil",
    dialCode: "+55",
    stateLabel: "State",
    postalExample: "01310-100",
    postalHint: "CEP code (e.g. 01310-100)",
    postalPattern: /^\d{5}-?\d{3}$/,
  },
  {
    code: "MX",
    name: "Mexico",
    dialCode: "+52",
    stateLabel: "State",
    postalExample: "06600",
    postalHint: "5-digit Mexican postal code",
    postalPattern: /^\d{5}$/,
  },
];

export const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  COUNTRY_DIRECTORY.map((c) => [c.code, c.name]),
);

const COUNTRY_META_MAP: Record<string, CountryMetadata> = Object.fromEntries(
  COUNTRY_DIRECTORY.map((c) => [c.code, c]),
);

export const COUNTRY_OPTIONS = COUNTRY_DIRECTORY.map((c) => ({
  value: c.code,
  label: `${c.name} (${c.code})`,
}));

export const PHONE_DIAL_CODE_OPTIONS = Array.from(
  new Map(
    COUNTRY_DIRECTORY.map((c) => [
      `${c.dialCode}:${c.code}`,
      { value: c.dialCode, label: `${c.code} (${c.dialCode})`, countryCode: c.code },
    ]),
  ).values(),
);

export function getCountryMeta(code: string): CountryMetadata | null {
  return COUNTRY_META_MAP[code.trim().toUpperCase()] ?? null;
}

export function getCountryDialCode(code: string): string {
  return getCountryMeta(code)?.dialCode ?? "+1";
}

export function getCountryStates(code: string): readonly CountryStateOption[] {
  return getCountryMeta(code)?.states ?? [];
}

export function formatCountryName(code: string): string {
  const upper = code.trim().toUpperCase();
  const label = COUNTRY_NAMES[upper];
  return label ? `${label} (${upper})` : upper;
}

export function splitPhoneByCountryDialCode(
  phone: string,
  countryCode: string,
): { dialCode: string; localNumber: string } {
  const trimmed = phone.trim();
  const preferredDial = getCountryDialCode(countryCode);
  if (!trimmed) {
    return { dialCode: preferredDial, localNumber: "" };
  }

  // Sort longest dial code first so +971 / +852 match before +1
  const sortedDials = Array.from(new Set(COUNTRY_DIRECTORY.map((c) => c.dialCode))).sort(
    (a, b) => b.length - a.length,
  );
  const matched = sortedDials.find((d) => trimmed.startsWith(d));
  if (matched) {
    return {
      dialCode: matched,
      localNumber: trimmed.slice(matched.length).trim(),
    };
  }

  return {
    dialCode: preferredDial,
    localNumber: trimmed.replace(/^\+/, "").trim(),
  };
}

export function formatPhoneWithDialCode(dialCode: string, localNumber: string): string {
  const cleanDial = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
  const cleanLocal = localNumber.trim().replace(/^\+/, "");
  return cleanLocal ? `${cleanDial} ${cleanLocal}` : "";
}

/**
 * Validates international telephone formatting (7-15 digits after formatting characters).
 */
export function validatePhoneNumber(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "Contact phone number is required.";
  }
  if (!/^[+\d][\d\s().-]{4,30}$/.test(trimmed)) {
    return "Enter a valid telephone number including country or area digits.";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Phone number must contain between 7 and 15 digits.";
  }
  return null;
}

/**
 * Validates postal/ZIP codes using country-specific patterns when defined.
 */
export function validatePostalCodeForCountry(
  postalCode: string,
  countryCode: string,
): string | null {
  const cleanPostal = postalCode.trim();
  const meta = getCountryMeta(countryCode);
  if (!cleanPostal) {
    return "Postal / ZIP code is required.";
  }

  if (meta?.postalPattern) {
    if (!meta.postalPattern.test(cleanPostal)) {
      return `Enter a valid ${meta.name} postal code (${meta.postalHint}).`;
    }
    return null;
  }

  if (!/^[A-Z0-9\s-]{2,14}$/i.test(cleanPostal)) {
    return "Enter a valid postal code (2 to 14 letters or digits).";
  }

  return null;
}
