import { mapAuthError, type MappedAuthError } from "@/lib/auth/identity-errors";

const COLLISION_AUTH_ERROR = "identity_already_exists";
const GENERIC_AUTH_ERROR = "generic";

export type OAuthCallbackAuthError =
  | typeof COLLISION_AUTH_ERROR
  | typeof GENERIC_AUTH_ERROR;

type OAuthCallbackErrorInput = {
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
};

export type ReturnedAuthErrorState = {
  authError: MappedAuthError | null;
  openLinkModal: boolean;
};

function presentText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function oauthCallbackAuthErrorParam(
  input: OAuthCallbackErrorInput,
): OAuthCallbackAuthError | null {
  const error = presentText(input.error);
  const errorCode = presentText(input.errorCode);
  const errorDescription = presentText(input.errorDescription);
  if (!error && !errorCode && !errorDescription) {
    return null;
  }

  const mapped = mapAuthError({
    code: errorCode || error,
    message: [errorDescription, error].filter(Boolean).join(" "),
  });
  if (mapped.kind === "identity_collision") {
    return COLLISION_AUTH_ERROR;
  }
  return GENERIC_AUTH_ERROR;
}

export function returnedAuthErrorState(
  raw: string | null | undefined,
): ReturnedAuthErrorState {
  const token = presentText(raw);
  if (!token) {
    return { authError: null, openLinkModal: false };
  }

  return {
    authError: mapAuthError({ code: token, message: token }),
    openLinkModal: true,
  };
}
