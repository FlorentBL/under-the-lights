export type AdminIdentity = {
  id: string;
  email: string;
  emailVerified: boolean;
};

export function parseAdminEmailAllowlist(value: string) {
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isVerifiedConfiguredAdmin(
  user: Pick<AdminIdentity, "email" | "emailVerified">,
  configuredEmails: ReadonlySet<string>,
) {
  return user.emailVerified && configuredEmails.has(user.email.trim().toLowerCase());
}
