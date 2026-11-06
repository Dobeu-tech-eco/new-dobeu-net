// Only these fixed messages may be displayed for an admin URL error code.
export const ADMIN_ERROR_MESSAGES = {
  company_create_failed: "Unable to create the company. Try again.",
  company_suspend_failed: "Unable to suspend the company. Try again.",
  company_reactivate_failed: "Unable to reactivate the company. Try again.",
  admin_provision_failed: "Unable to provision the company admin. Try again.",
  admin_invitee_needs_link_signin:
    "That account has not signed in with an emailed link yet. Ask them to sign in with an emailed link, then try again.",
  admin_already_member: "That user is already a member of this company.",
  project_save_failed: "Unable to save the project. Try again.",
  load_failed: "Unable to load admin data. Try again.",
  overview_load_failed: "Unable to load some overview data. Try again.",
  activity_partial: "Some recent activity could not be loaded.",
  totals_truncated: "Totals truncated; too many rows to sum here.",
  unknown: "Something went wrong. Try again.",
} as const;

export type AdminErrorCode = keyof typeof ADMIN_ERROR_MESSAGES;

export function adminErrorMessage(code: string): string {
  return Object.hasOwn(ADMIN_ERROR_MESSAGES, code)
    ? ADMIN_ERROR_MESSAGES[code as AdminErrorCode]
    : ADMIN_ERROR_MESSAGES.unknown;
}

/** Fixed redirect code for a provisionCompanyAdmin failure (never provider text). */
export function provisionErrorCode(error: string): AdminErrorCode {
  switch (error) {
    case "invitee_needs_link_signin":
      return "admin_invitee_needs_link_signin";
    case "already_member":
      return "admin_already_member";
    default:
      return "admin_provision_failed";
  }
}
