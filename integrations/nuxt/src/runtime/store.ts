import type { AppContract } from "#build/types/letters-patent.d.ts";
import type { State } from "letters-patent/kit";

import { useState } from "#imports";

import { STATE_KEY } from "../constant";

/**
 * The per-request container the auth service is built over. Held in
 * `useState` so its `current` member survives the server→client transfer
 * and Vue tracks the in-place mutations the guarded state makes — the
 * service itself stays reactivity-agnostic.
 */
export const accessAuthState = () =>
  useState<State<AppContract>>(STATE_KEY, () => ({ current: null }));
