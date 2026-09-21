export const ACCOUNT_DELETION_CONFIRM_TEXT = "DELETE";

export function canConfirmAccountDeletion(value: string): boolean {
  return value.trim() === ACCOUNT_DELETION_CONFIRM_TEXT;
}
