"use client";

import { useActionState } from "react";
import {
  initialBusinessActionState,
  updateBusinessProfileAction,
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
  isKnownTimezone,
} from "@/lib/data/countries";

export function BusinessProfileForm({
  businessId,
  business,
}: {
  businessId: string;
  business: {
    name: string;
    category: string | null;
    description: string | null;
    country: string;
    location: string | null;
    phone: string | null;
    email: string | null;
    timezone: string;
  };
}) {
  const [state, action, pending] = useActionState(
    updateBusinessProfileAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const error = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={action} className="space-y-6" aria-busy={pending}>
      <input type="hidden" name="businessId" value={businessId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="profile-name"
          name="name"
          label="Business name"
          defaultValue={business.name}
          required
          error={error("name")}
        />
        <TextField
          id="profile-category"
          name="category"
          label="Category"
          defaultValue={business.category ?? ""}
          error={error("category")}
        />
        <SelectField
          id="profile-country"
          name="country"
          label="Country"
          defaultValue={business.country}
          required
          error={error("country")}
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
          {COUNTRY_OPTIONS.some((option) => option.code === business.country) ? null : (
            <option value={business.country}>{business.country}</option>
          )}
        </SelectField>
        <SelectField
          id="profile-timezone"
          name="timezone"
          label="Timezone"
          defaultValue={business.timezone}
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
          {isKnownTimezone(business.timezone) ? null : (
            <option value={business.timezone}>{business.timezone}</option>
          )}
        </SelectField>
        <TextField
          id="profile-email"
          name="email"
          type="email"
          label="Business email"
          defaultValue={business.email ?? ""}
          error={error("email")}
        />
        <TextField
          id="profile-phone"
          name="phone"
          type="tel"
          label="Business phone"
          defaultValue={business.phone ?? ""}
          error={error("phone")}
        />
        <TextField
          id="profile-location"
          name="location"
          label="Location"
          defaultValue={business.location ?? ""}
          error={error("location")}
        />
      </div>
      <TextAreaField
        id="profile-description"
        name="description"
        label="Business description"
        defaultValue={business.description ?? ""}
        error={error("description")}
      />
      <ActionMessage state={state} />
      <ActionSubmitButton pending={pending}>Save business profile</ActionSubmitButton>
    </form>
  );
}
