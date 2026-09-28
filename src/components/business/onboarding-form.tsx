"use client";

import { initialBusinessActionState } from "@/lib/actions/business-state";

import { useActionState, useState } from "react";
import {
  createBusinessAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/business/form-controls";
import {
  COUNTRY_OPTIONS,
  TIMEZONE_GROUP_ORDER,
  TIMEZONE_OPTIONS,
  defaultTimezoneForCountry,
} from "@/lib/data/countries";

export function BusinessOnboardingForm() {
  const [state, action, pending] = useActionState(
    createBusinessAction, initialBusinessActionState);
  const [country, setCountry] = useState("RW");
  const [timezone, setTimezone] = useState("Africa/Kigali");
  const error = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={action} className="space-y-6" aria-busy={pending}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="business-name"
          name="name"
          label="Business name"
          autoComplete="organization"
          required
          error={error("name")}
        />
        <TextField
          id="business-slug"
          name="slug"
          label="Business URL slug"
          hint="Optional. Letters, numbers, and hyphens only."
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          error={error("slug")}
        />
        <TextField
          id="business-category"
          name="category"
          label="Category"
          placeholder="Retail, services, consulting…"
          error={error("category")}
        />
        <SelectField
          id="business-country"
          name="country"
          label="Country"
          value={country}
          onChange={(event) => {
            const next = event.target.value;
            setCountry(next);
            setTimezone(defaultTimezoneForCountry(next));
          }}
          required
          error={error("country")}
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="business-timezone"
          name="timezone"
          label="Timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          hint="Used for report dates and scheduled reminders."
          required
          error={error("timezone")}
        >
          {TIMEZONE_GROUP_ORDER.map((group) => (
            <optgroup key={group} label={group}>
              {TIMEZONE_OPTIONS.filter((option) => option.group === group).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <TextField
          id="business-email"
          name="email"
          type="email"
          label="Business email"
          autoComplete="email"
          error={error("email")}
        />
        <TextField id="business-phone" name="phone" type="tel" label="Business phone" error={error("phone")} />
        <TextField id="business-location" name="location" label="Location" error={error("location")} />
      </div>
      <TextAreaField
        id="business-description"
        name="description"
        label="Business description"
        error={error("description")}
      />
      <ActionMessage state={state} />
      <ActionSubmitButton pending={pending} className="w-full">
        Create business workspace
      </ActionSubmitButton>
      <p className="text-xs leading-5 text-slate-600">
        The configured plan, trial, invoice, roles, permissions, owner membership, audit entry, and
        initial notification are created together. Nothing is marked paid automatically.
      </p>
    </form>
  );
}
