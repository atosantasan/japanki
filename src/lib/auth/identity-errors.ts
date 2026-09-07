export type AuthErrorLike = {
  code?: string | null;
  message?: string | null;
};

export type MappedAuthError = {
  kind: "identity_collision" | "generic";
  merge: false;
  messageKey: "collisionBody" | "genericError";
};

const COLLISION_CODES = new Set([
  "identity_already_exists",
  "identity_already_linked",
  "email_exists",
  "user_already_exists",
]);

const COLLISION_SNIPPETS = [
  "already linked",
  "already been registered",
  "already associated",
  "identity is already",
  "email already",
];

export function mapAuthError(error: AuthErrorLike | null | undefined): MappedAuthError {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";

  const isCollision =
    COLLISION_CODES.has(code) ||
    COLLISION_SNIPPETS.some((snippet) => message.includes(snippet));

  if (isCollision) {
    return {
      kind: "identity_collision",
      merge: false,
      messageKey: "collisionBody",
    };
  }

  return {
    kind: "generic",
    merge: false,
    messageKey: "genericError",
  };
}
