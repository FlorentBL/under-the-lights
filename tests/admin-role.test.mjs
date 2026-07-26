import assert from "node:assert/strict";
import test from "node:test";
import {
  isVerifiedConfiguredAdmin,
  parseAdminEmailAllowlist,
} from "../lib/admin-role.ts";

const allowlist = parseAdminEmailAllowlist(" owner@example.com,EDITOR@example.com ");

test("configured admin matching is normalized and requires verification", () => {
  assert.equal(isVerifiedConfiguredAdmin({
    email: "OWNER@example.com",
    emailVerified: true,
  }, allowlist), true);
  assert.equal(isVerifiedConfiguredAdmin({
    email: "owner@example.com",
    emailVerified: false,
  }, allowlist), false);
});

test("an arbitrary verified email does not receive configured admin access", () => {
  assert.equal(isVerifiedConfiguredAdmin({
    email: "attacker@example.com",
    emailVerified: true,
  }, allowlist), false);
});
