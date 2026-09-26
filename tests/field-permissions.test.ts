import { describe, expect, it } from "vitest";

import {
  canAccessRestrictedField,
  FIELD_RESTRICTABLE_PERMISSION_KEYS,
  normalizeRestrictedPermissionKeys,
  restrictRecordData,
  visibleFieldKeys,
  type BusinessPermissionKey,
} from "../src/lib/permissions";
import { permissionsForRole } from "../src/lib/permissions";

const salaryField = {
  key: "monthly_salary",
  allowedPermissionKeys: ["records.edit"] as string[],
};
const notesField = {
  key: "internal_notes",
  allowedPermissionKeys: [] as string[],
};

describe("field visibility rules", () => {
  it("treats a field with no restrictions as visible to everyone", () => {
    expect(canAccessRestrictedField(notesField.allowedPermissionKeys, [])).toBe(true);
    expect(canAccessRestrictedField(notesField.allowedPermissionKeys, ["tables.view"])).toBe(
      true,
    );
  });

  it("hides a restricted field from roles without a matching permission", () => {
    expect(canAccessRestrictedField(salaryField.allowedPermissionKeys, ["records.view"])).toBe(
      false,
    );
    expect(
      canAccessRestrictedField(salaryField.allowedPermissionKeys, ["records.view", "records.edit"]),
    ).toBe(true);
  });

  it("grants access when any one allowed permission matches", () => {
    const allowed = ["tables.edit", "people.manage_users"];
    expect(canAccessRestrictedField(allowed, ["people.manage_users"])).toBe(true);
    expect(canAccessRestrictedField(allowed, ["records.export"])).toBe(false);
  });

  it("keeps visible field keys and drops restricted ones", () => {
    const fields = [
      salaryField,
      notesField,
      { key: "status", allowedPermissionKeys: [] as string[] },
    ];
    const keys = visibleFieldKeys(fields, ["records.view", "tables.view"]);
    expect([...keys].sort()).toEqual(["internal_notes", "status"]);

    const editorKeys = visibleFieldKeys(fields, ["records.view", "records.edit"]);
    expect([...editorKeys].sort()).toEqual(["internal_notes", "monthly_salary", "status"]);
  });

  it("resolves visibility from real default role permissions", () => {
    const employee = permissionsForRole("EMPLOYEE") as readonly string[];
    const readOnly = permissionsForRole("READ_ONLY") as readonly string[];
    const owner = permissionsForRole("OWNER") as readonly string[];

    expect(employee).toContain("records.edit");
    expect(readOnly).not.toContain("records.edit");
    expect(canAccessRestrictedField(salaryField.allowedPermissionKeys, employee)).toBe(true);
    expect(canAccessRestrictedField(salaryField.allowedPermissionKeys, readOnly)).toBe(false);
    expect(canAccessRestrictedField(salaryField.allowedPermissionKeys, owner)).toBe(true);
  });
});

describe("record data restriction", () => {
  it("removes values the member cannot see", () => {
    const data = {
      full_name: "Aline Uwase",
      monthly_salary: 450,
      internal_notes: "Reviewed",
    };
    const keys = visibleFieldKeys(
      [salaryField, notesField, { key: "full_name", allowedPermissionKeys: [] as string[] }],
      ["records.view"],
    );
    expect(restrictRecordData(data, keys)).toEqual({
      full_name: "Aline Uwase",
      internal_notes: "Reviewed",
    });
  });

  it("drops unknown keys that no longer belong to a field", () => {
    const keys = visibleFieldKeys([notesField], ["records.view"]);
    expect(
      restrictRecordData({ internal_notes: "Reviewed", removed_field: "stale" }, keys),
    ).toEqual({ internal_notes: "Reviewed" });
  });

  it("returns an empty object when no field is visible", () => {
    const keys = visibleFieldKeys([salaryField], []);
    expect(restrictRecordData({ monthly_salary: 1 }, keys)).toEqual({});
  });
});

describe("restricted permission normalization", () => {
  it("drops unknown keys, de-duplicates, and sorts", () => {
    expect(
      normalizeRestrictedPermissionKeys([
        "records.export",
        "records.export",
        "not.a.permission",
        42,
        null,
        "tables.edit",
      ]),
    ).toEqual(["records.export", "tables.edit"]);
  });

  it("returns an empty list for non-array input", () => {
    expect(normalizeRestrictedPermissionKeys("records.edit")).toEqual([]);
    expect(normalizeRestrictedPermissionKeys(undefined)).toEqual([]);
  });

  it("only offers real business permission keys as restrictions", () => {
    for (const key of FIELD_RESTRICTABLE_PERMISSION_KEYS) {
      expect(normalizeRestrictedPermissionKeys([key])).toEqual([
        key as BusinessPermissionKey,
      ]);
    }
  });
});
