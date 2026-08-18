import type { Contract, Meta, Schema, User } from "@letters-patent/schema";

/**
 * A step in a mutation path: the member keys walked from the user root down
 * to the object a write lands on. Array indices travel as the strings the
 * proxy traps receive them as.
 */
export type Path = string[];

/**
 * An object under navigation, addressed by key.
 */
export type Node = Record<string, unknown>;

/**
 * The state container the service and its provider share. The service owns
 * it; provider callbacks receive it and assign `current` — the channel by
 * which a provider hands letters-patent what it needs.
 */
export interface State<C extends Contract> {
  current: User<Meta<C>> | null;
}

/**
 * The bridge between a vendor's payload and an app's contract: maps what
 * the authentication API returns (a session, a claims object) into the
 * app's own user shape. Written by the app — the one place that knows both
 * sides — and handed to a provider constructor, which closes `C` with it.
 */
export type Bridge<Payload, C extends Contract> = (
  payload: Payload,
) => User<Meta<C>>;

/**
 * The interaction contract between letters-patent and an authentication service.
 * Crest never implements authentication — a provider wraps a particular
 * auth API (Auth0, a homegrown JWT backend, …) as a set of callbacks over
 * letters-patent's own domain objects. Each callback receives the shared state and
 * the schema — the validation bundle for proving vendor payloads at the
 * boundary; everything else a flow needs — configuration, credentials,
 * request context — is the provider's own, acquired in its own domain.
 */
export interface Provider<C extends Contract> {
  /**
   * Initiate authentication, assigning `state.current` on success. A flow
   * that continues out-of-band (redirect-based login) leaves state
   * untouched — `resolve` picks the session up when the flow returns.
   */
  login(state: State<C>, schema: Schema<C>): Promise<void>;

  /**
   * Tear down the session of `state.current` on the authentication side.
   */
  logout(state: State<C>, schema: Schema<C>): Promise<void>;

  /**
   * Establish the user from ambient context — cookie, header, token —
   * assigning `state.current`. The single authoritative way user state is
   * discovered: called on boot, per request, or after an out-of-band login
   * flow returns.
   */
  resolve(state: State<C>, schema: Schema<C>): Promise<void>;

  /**
   * Revalidate or extend the session of `state.current`, reassigning it —
   * or clearing it when the session is gone.
   */
  refresh?(state: State<C>, schema: Schema<C>): Promise<void>;
}
