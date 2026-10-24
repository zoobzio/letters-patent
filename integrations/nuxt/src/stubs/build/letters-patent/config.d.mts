// Typecheck-only stub for the `letters-patent/config.d.mts` template the
// module emits from the app's contract with @letters-patent/kit.
import type { Meta as PatentMeta, User as PatentUser } from "letters-patent";

export type Contract = {
  scopes: readonly ["docs:read", "docs:write"];
  roles: readonly ["editor", "admin"];
  groups: readonly ["eng"];
  entitlements: readonly ["beta"];
  meta: { plan: readonly ["free", "pro"] };
};
export type Meta = PatentMeta<Contract>;
export type User = PatentUser<Meta>;
export declare const contract: Contract;
declare const config: { readonly contract: Contract };
export default config;
