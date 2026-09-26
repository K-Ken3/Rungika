export const MEMBERSHIP_ROLE_VALUES = [
  "OWNER",
  "MANAGER",
  "EMPLOYEE",
  "READ_ONLY",
] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLE_VALUES)[number];

export const PERMISSION_ACTION_VALUES = [
  "VIEW",
  "CREATE",
  "EDIT",
  "DELETE",
  "EXPORT",
  "MANAGE_USERS",
  "MANAGE_SETTINGS",
  "MANAGE_BILLING",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTION_VALUES)[number];

export const BUSINESS_PERMISSION_DEFINITIONS = {
  "dashboard.view": {
    module: "dashboard",
    action: "VIEW",
    description: "View the business dashboard",
  },
  "business.view": {
    module: "business",
    action: "VIEW",
    description: "View business details",
  },
  "business.create": {
    module: "business",
    action: "CREATE",
    description: "Create businesses",
  },
  "business.edit": {
    module: "business",
    action: "EDIT",
    description: "Edit business details",
  },
  "business.delete": {
    module: "business",
    action: "DELETE",
    description: "Delete businesses",
  },
  "business.export": {
    module: "business",
    action: "EXPORT",
    description: "Export business data",
  },
  "business.manage_users": {
    module: "business",
    action: "MANAGE_USERS",
    description: "Manage business users",
  },
  "business.manage_settings": {
    module: "business",
    action: "MANAGE_SETTINGS",
    description: "Manage business settings",
  },
  "business.manage_billing": {
    module: "business",
    action: "MANAGE_BILLING",
    description: "Manage business billing",
  },
  "people.view": {
    module: "people",
    action: "VIEW",
    description: "View people",
  },
  "people.create": {
    module: "people",
    action: "CREATE",
    description: "Invite or create people",
  },
  "people.edit": {
    module: "people",
    action: "EDIT",
    description: "Edit people",
  },
  "people.delete": {
    module: "people",
    action: "DELETE",
    description: "Remove people",
  },
  "people.export": {
    module: "people",
    action: "EXPORT",
    description: "Export people data",
  },
  "people.manage_users": {
    module: "people",
    action: "MANAGE_USERS",
    description: "Manage people permissions",
  },
  "tables.view": {
    module: "tables",
    action: "VIEW",
    description: "View tables",
  },
  "tables.create": {
    module: "tables",
    action: "CREATE",
    description: "Create tables",
  },
  "tables.edit": {
    module: "tables",
    action: "EDIT",
    description: "Edit tables",
  },
  "tables.delete": {
    module: "tables",
    action: "DELETE",
    description: "Delete tables",
  },
  "tables.export": {
    module: "tables",
    action: "EXPORT",
    description: "Export table data",
  },
  "records.view": {
    module: "records",
    action: "VIEW",
    description: "View records",
  },
  "records.create": {
    module: "records",
    action: "CREATE",
    description: "Create records",
  },
  "records.edit": {
    module: "records",
    action: "EDIT",
    description: "Edit records",
  },
  "records.delete": {
    module: "records",
    action: "DELETE",
    description: "Delete records",
  },
  "records.export": {
    module: "records",
    action: "EXPORT",
    description: "Export records",
  },
  "units.view": {
    module: "units",
    action: "VIEW",
    description: "View business units",
  },
  "units.create": {
    module: "units",
    action: "CREATE",
    description: "Create business units",
  },
  "units.edit": {
    module: "units",
    action: "EDIT",
    description: "Edit business units",
  },
  "units.delete": {
    module: "units",
    action: "DELETE",
    description: "Delete business units",
  },
  "billing.view": {
    module: "billing",
    action: "VIEW",
    description: "View billing information",
  },
  "billing.export": {
    module: "billing",
    action: "EXPORT",
    description: "Export billing information",
  },
  "billing.manage_billing": {
    module: "billing",
    action: "MANAGE_BILLING",
    description: "Manage billing",
  },
  "settings.view": {
    module: "settings",
    action: "VIEW",
    description: "View business settings",
  },
  "settings.edit": {
    module: "settings",
    action: "EDIT",
    description: "Edit business settings",
  },
  "settings.manage_settings": {
    module: "settings",
    action: "MANAGE_SETTINGS",
    description: "Manage business settings",
  },
  "notifications.view": {
    module: "notifications",
    action: "VIEW",
    description: "View notifications",
  },
  "notifications.create": {
    module: "notifications",
    action: "CREATE",
    description: "Create notifications",
  },
  "notifications.edit": {
    module: "notifications",
    action: "EDIT",
    description: "Edit notifications",
  },
  "notifications.delete": {
    module: "notifications",
    action: "DELETE",
    description: "Delete notifications",
  },
  "support.view": {
    module: "support",
    action: "VIEW",
    description: "View support cases",
  },
  "support.create": {
    module: "support",
    action: "CREATE",
    description: "Create support cases",
  },
  "support.edit": {
    module: "support",
    action: "EDIT",
    description: "Edit support cases",
  },
} as const satisfies Record<
  string,
  {
    module: string;
    action: PermissionAction;
    description: string;
  }
>;

export type BusinessPermissionKey = keyof typeof BUSINESS_PERMISSION_DEFINITIONS;

export const BUSINESS_PERMISSION_KEYS = Object.keys(
  BUSINESS_PERMISSION_DEFINITIONS,
) as BusinessPermissionKey[];

export const BUSINESS_PERMISSIONS = BUSINESS_PERMISSION_KEYS;

const VIEW_PERMISSIONS = BUSINESS_PERMISSION_KEYS.filter((key) =>
  key.endsWith(".view"),
);

const CONTENT_PERMISSIONS = BUSINESS_PERMISSION_KEYS.filter((key) =>
  key.startsWith("tables.") || key.startsWith("records.") || key.startsWith("units."),
);

export const ROLE_PERMISSIONS = {
  OWNER: BUSINESS_PERMISSION_KEYS,
  MANAGER: BUSINESS_PERMISSION_KEYS.filter(
    (key) => key !== "business.manage_billing",
  ),
  EMPLOYEE: [
    ...VIEW_PERMISSIONS,
    ...CONTENT_PERMISSIONS.filter((key) =>
      key.endsWith(".create") || key.endsWith(".edit"),
    ),
  ],
  READ_ONLY: VIEW_PERMISSIONS,
} as const satisfies Record<MembershipRole, readonly BusinessPermissionKey[]>;

export const FIELD_RESTRICTABLE_PERMISSION_KEYS = [
  "tables.edit",
  "tables.export",
  "records.edit",
  "records.export",
  "people.manage_users",
] as const satisfies readonly BusinessPermissionKey[];

export const PERMISSION_DEFINITIONS = BUSINESS_PERMISSION_DEFINITIONS;

function normalizeRole(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function isMembershipRole(value: unknown): value is MembershipRole {
  return (
    typeof value === "string" &&
    (MEMBERSHIP_ROLE_VALUES as readonly string[]).includes(value)
  );
}

export function permissionsForRole(
  role: string | null | undefined,
): readonly BusinessPermissionKey[] {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole || !isMembershipRole(normalizedRole)) {
    return [];
  }
  return ROLE_PERMISSIONS[normalizedRole];
}

export function hasPermission(
  role: string | null | undefined,
  permission: BusinessPermissionKey,
) {
  return permissionsForRole(role).includes(permission);
}

export function hasPermissionKey(
  permissions: readonly string[],
  permission: string,
): permission is BusinessPermissionKey {
  return Object.prototype.hasOwnProperty.call(
    BUSINESS_PERMISSION_DEFINITIONS,
    permission,
  ) && permissions.includes(permission);
}

export function isRestrictedPermissionKey(value: unknown): value is BusinessPermissionKey {
  return (
    typeof value === "string" &&
    (FIELD_RESTRICTABLE_PERMISSION_KEYS as readonly string[]).includes(value)
  );
}

export function normalizeRestrictedPermissionKeys(values: unknown): BusinessPermissionKey[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const normalized = values
    .filter(isRestrictedPermissionKey)
    .filter((value, index, list) => list.indexOf(value) === index);
  return normalized.sort((left, right) => left.localeCompare(right));
}

export function canAccessRestrictedField(
  allowedPermissionKeys: readonly string[],
  permissionKeys: readonly string[],
): boolean {
  if (allowedPermissionKeys.length === 0) {
    return true;
  }
  return allowedPermissionKeys.some((key) => permissionKeys.includes(key));
}

export function visibleFieldKeys(
  fields: ReadonlyArray<{ key: string; allowedPermissionKeys: readonly string[] }>,
  permissionKeys: readonly string[],
): Set<string> {
  return new Set(
    fields
      .filter((field) =>
        canAccessRestrictedField(field.allowedPermissionKeys, permissionKeys),
      )
      .map((field) => field.key),
  );
}

export function restrictRecordData(
  data: Record<string, unknown>,
  fieldKeys: ReadonlySet<string>,
): Record<string, unknown> {
  const restricted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (fieldKeys.has(key)) {
      restricted[key] = value;
    }
  }
  return restricted;
}
