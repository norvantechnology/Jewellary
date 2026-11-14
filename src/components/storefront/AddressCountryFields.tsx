"use client";

import { useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  COUNTRY_OPTIONS,
  formatCountryName,
  formatPhoneWithDialCode,
  getCountryDialCode,
  getCountryStates,
  PHONE_DIAL_CODE_OPTIONS,
  splitPhoneByCountryDialCode,
} from "@/lib/countries";

interface CountrySelectFieldProps {
  id: string;
  value: string;
  onChange: (nextCountry: string) => void;
  allowedCountryCodes?: readonly string[];
  inModal?: boolean;
  ariaDescribedBy?: string;
}

export function CountrySelectField({
  id,
  value,
  onChange,
  allowedCountryCodes,
  inModal = false,
  ariaDescribedBy,
}: CountrySelectFieldProps) {
  const a = useUiText().checkout.addressPickers;
  const options = React.useMemo<ComboboxOption[]>(() => {
    if (allowedCountryCodes && allowedCountryCodes.length > 0) {
      return allowedCountryCodes.map((code) => ({
        value: code.toUpperCase(),
        label: formatCountryName(code),
      }));
    }
    return COUNTRY_OPTIONS;
  }, [allowedCountryCodes]);

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      inModal={inModal}
      aria-describedby={ariaDescribedBy}
      placeholder={a.selectCountry}
      searchPlaceholder={a.searchCountry}
      onValueChange={(next) => {
        if (next && next !== value) {
          onChange(next);
        }
      }}
    />
  );
}

interface StateRegionFieldProps {
  id: string;
  country: string;
  value: string;
  onChange: (nextState: string) => void;
  autoComplete?: string;
  inModal?: boolean;
  required?: boolean;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  name?: string;
  onBlur?: () => void;
}

export function StateRegionField({
  id,
  country,
  value,
  onChange,
  autoComplete,
  inModal = false,
  required,
  ariaDescribedBy,
  ariaInvalid,
  name,
  onBlur,
}: StateRegionFieldProps) {
  const a = useUiText().checkout.addressPickers;
  const states = React.useMemo(() => getCountryStates(country), [country]);

  if (states.length === 0) {
    return (
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        placeholder={a.stateFreeText}
      />
    );
  }

  const matched = states.find(
    (s) =>
      s.code.toLowerCase() === value.trim().toLowerCase() ||
      s.name.toLowerCase() === value.trim().toLowerCase(),
  );

  const options: ComboboxOption[] = states.map((s) => ({
    value: s.code,
    label: `${s.name} (${s.code})`,
  }));

  return (
    <Combobox
      id={id}
      options={options}
      value={matched?.code ?? ""}
      inModal={inModal}
      aria-describedby={ariaDescribedBy}
      placeholder={a.selectState}
      searchPlaceholder={a.searchState}
      onValueChange={(next) => {
        if (next) {
          onChange(next);
        }
      }}
    />
  );
}

interface PhoneWithDialCodeInputProps {
  id: string;
  country: string;
  value: string;
  onChange: (fullPhone: string) => void;
  autoComplete?: string;
  required?: boolean;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  name?: string;
  onBlur?: () => void;
}

export function PhoneWithDialCodeInput({
  id,
  country,
  value,
  onChange,
  autoComplete,
  required,
  ariaDescribedBy,
  ariaInvalid,
  name,
  onBlur,
}: PhoneWithDialCodeInputProps) {
  const a = useUiText().checkout.addressPickers;
  const split = React.useMemo(() => splitPhoneByCountryDialCode(value, country), [value, country]);
  const [dialOverride, setDialOverride] = React.useState<{
    country: string;
    dialCode: string;
  } | null>(null);

  const dialCode = value.trim()
    ? split.dialCode
    : dialOverride?.country === country
      ? dialOverride.dialCode
      : getCountryDialCode(country);

  const handleDialChange = (nextDial: string) => {
    setDialOverride({ country, dialCode: nextDial });
    if (split.localNumber) {
      onChange(formatPhoneWithDialCode(nextDial, split.localNumber));
    }
  };

  const handleNumberChange = (raw: string) => {
    if (raw.trim().startsWith("+")) {
      const parsed = splitPhoneByCountryDialCode(raw, country);
      setDialOverride({ country, dialCode: parsed.dialCode });
      onChange(raw);
      return;
    }
    onChange(raw ? formatPhoneWithDialCode(dialCode, raw) : "");
  };

  return (
    <div className="flex items-stretch gap-2">
      <NativeSelect
        aria-label={a.dialCodeAria}
        value={dialCode}
        onChange={(e) => handleDialChange(e.target.value)}
        className="h-12 min-h-12 w-24 shrink-0 min-[380px]:w-28 md:h-11 md:min-h-11"
      >
        {PHONE_DIAL_CODE_OPTIONS.map((opt) => (
          <option key={`${opt.countryCode}-${opt.value}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </NativeSelect>
      <Input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        required={required}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        value={split.localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        onBlur={onBlur}
        placeholder={a.phonePlaceholder}
        className="min-w-0 flex-1"
      />
    </div>
  );
}
