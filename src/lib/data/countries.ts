export type CountryOption = {
  code: string;
  name: string;
  defaultTimezone: string;
};

export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: "RW", name: "Rwanda", defaultTimezone: "Africa/Kigali" },
  { code: "GH", name: "Ghana", defaultTimezone: "Africa/Accra" },
  { code: "KE", name: "Kenya", defaultTimezone: "Africa/Nairobi" },
  { code: "NG", name: "Nigeria", defaultTimezone: "Africa/Lagos" },
  { code: "ZA", name: "South Africa", defaultTimezone: "Africa/Johannesburg" },
  { code: "TZ", name: "Tanzania", defaultTimezone: "Africa/Dar_es_Salaam" },
  { code: "UG", name: "Uganda", defaultTimezone: "Africa/Kampala" },
  { code: "ET", name: "Ethiopia", defaultTimezone: "Africa/Addis_Ababa" },
  { code: "US", name: "United States", defaultTimezone: "America/New_York" },
  { code: "CA", name: "Canada", defaultTimezone: "America/Toronto" },
  { code: "GB", name: "United Kingdom", defaultTimezone: "Europe/London" },
  { code: "AU", name: "Australia", defaultTimezone: "Australia/Sydney" },
] as const;

export type TimezoneOption = {
  value: string;
  label: string;
  group: "Africa" | "Europe" | "Americas" | "Asia" | "Oceania" | "Universal";
};

export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: "Africa/Kigali", label: "Kigali, Rwanda", group: "Africa" },
  { value: "Africa/Accra", label: "Accra, Ghana", group: "Africa" },
  { value: "Africa/Nairobi", label: "Nairobi, Kenya", group: "Africa" },
  { value: "Africa/Lagos", label: "Lagos, Nigeria", group: "Africa" },
  { value: "Africa/Johannesburg", label: "Johannesburg, South Africa", group: "Africa" },
  { value: "Africa/Dar_es_Salaam", label: "Dar es Salaam, Tanzania", group: "Africa" },
  { value: "Africa/Kampala", label: "Kampala, Uganda", group: "Africa" },
  { value: "Africa/Addis_Ababa", label: "Addis Ababa, Ethiopia", group: "Africa" },
  { value: "Africa/Cairo", label: "Cairo, Egypt", group: "Africa" },

  { value: "Europe/London", label: "London, United Kingdom", group: "Europe" },
  { value: "Europe/Paris", label: "Paris, France", group: "Europe" },
  { value: "Europe/Berlin", label: "Berlin, Germany", group: "Europe" },

  { value: "America/New_York", label: "New York, United States", group: "Americas" },
  { value: "America/Chicago", label: "Chicago, United States", group: "Americas" },
  { value: "America/Denver", label: "Denver, United States", group: "Americas" },
  { value: "America/Los_Angeles", label: "Los Angeles, United States", group: "Americas" },
  { value: "America/Toronto", label: "Toronto, Canada", group: "Americas" },
  { value: "America/Vancouver", label: "Vancouver, Canada", group: "Americas" },
  { value: "America/Mexico_City", label: "Mexico City, Mexico", group: "Americas" },
  { value: "America/Bogota", label: "Bogota, Colombia", group: "Americas" },
  { value: "America/Sao_Paulo", label: "Sao Paulo, Brazil", group: "Americas" },

  { value: "Asia/Dubai", label: "Dubai, United Arab Emirates", group: "Asia" },
  { value: "Asia/Kolkata", label: "Kolkata, India", group: "Asia" },
  { value: "Asia/Singapore", label: "Singapore", group: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo, Japan", group: "Asia" },
  { value: "Asia/Shanghai", label: "Shanghai, China", group: "Asia" },

  { value: "Australia/Sydney", label: "Sydney, Australia", group: "Oceania" },
  { value: "Pacific/Auckland", label: "Auckland, New Zealand", group: "Oceania" },

  { value: "UTC", label: "UTC (Coordinated Universal Time)", group: "Universal" },
] as const;

export const TIMEZONE_GROUP_ORDER: readonly TimezoneOption["group"][] = [
  "Africa",
  "Europe",
  "Americas",
  "Asia",
  "Oceania",
  "Universal",
] as const;

export function isKnownTimezone(value: string) {
  return TIMEZONE_OPTIONS.some((option) => option.value === value);
}

export function defaultTimezoneForCountry(code: string) {
  return COUNTRY_OPTIONS.find((option) => option.code === code)?.defaultTimezone ?? "UTC";
}
