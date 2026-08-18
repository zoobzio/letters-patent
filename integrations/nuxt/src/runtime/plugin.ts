import type { AppContract } from "#build/types/letters-patent.d.ts";

import { defineCrest, defineSchema } from "letters-patent";

import { defineNuxtPlugin } from "#app";
import { contract, prefix } from "#build/letters-patent.mjs";

import { accessAuthState } from "./store";
import { transport } from "./transport";

/**
 * Builds the auth service once per request over the `useState`-backed
 * container and provides it as `$auth`. The schema derives from the
 * build-time contract, so the same vocabulary rules both sides of the wire.
 * During SSR the service resolves through the transport (which forwards the
 * request cookies to the session route), so state is populated before
 * render and serializes to the client. On the client the state is already
 * hydrated, so it does not resolve again — no refetch, no auth flash.
 */
export default defineNuxtPlugin({
  name: "letters-patent",
  setup: async () => {
    const schema = defineSchema(contract);
    const state = accessAuthState();
    const auth = defineCrest(
      schema,
      transport<AppContract>(prefix),
      state.value,
    );

    if (import.meta.server) {
      await auth.resolve();
    }

    return {
      provide: { auth },
    };
  },
});
