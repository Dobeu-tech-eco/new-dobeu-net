// Only these fixed messages may be displayed for an admin URL error code.
export const ADMIN_ERROR_MESSAGES = {
  company_create_failed: "Unable to create the company. Try again.",
  company_suspend_failed: "Unable to suspend the company. Try again.",
  company_reactivate_failed: "Unable to reactivate the company. Try again.",
  admin_provision_failed: "Unable to provision the company admin. Try again.",
  project_save_failed: "Unable to save the project. Try again.",
  load_failed: "Unable to load admin data. Try again.",
  unknown: "Something went wrong. Try again.",
} as const;

export type AdminErrorCode = keyof typeof ADMIN_ERROR_MESSAGES;

export function adminErrorMessage(code: string): string {
  return Object.hasOwn(ADMIN_ERROR_MESSAGES, code)
    ? ADMIN_ERROR_MESSAGES[code as AdminErrorCode]
    : ADMIN_ERROR_MESSAGES.unknown;
}
