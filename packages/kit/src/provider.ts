import type { Contract, Schema } from "@letters-patent/schema";
import type { Bridge, Provider } from "./types";

/**
 * Author a provider constructor — the published artifact of an integration
 * (`@letters-patent/auth0`, …) and the same entry point homegrown providers use.
 *
 * The implementation is the internal mechanism, written at the root
 * {@link Contract}: vendor terms only — `Options` and `Payload` are the
 * author's own, and the app's contract is reached solely through the
 * bridge. The returned constructor is the typed front door: the app calls
 * it once, and the schema argument pins `C` — its `base` carries the
 * contract in a plainly inferable slot — so the bridge is contextually
 * typed against the app's own vocabulary with no annotation anywhere.
 */
export const defineProvider = <Options, Payload>(
  impl: (
    options: Options,
    bridge: Bridge<Payload, Contract>,
  ) => Provider<Contract>,
) => {
  return <C extends Contract>(
    schema: Schema<C>,
    options: Options,
    bridge: Bridge<Payload, C>,
  ): Provider<C> => {
    return impl(options, (payload) => {
      const results = bridge(payload);
      return schema.parse.user(results);
    });
  };
};
