// Typecheck-only stub for the `types/letters-patent.d.ts` type template the
// module derives from the app's contract.
export type AppContract = {
  scopes: readonly ["docs:read", "docs:write"];
  roles: readonly ["editor", "admin"];
  meta: { plan: readonly ["free", "pro"] };
};
