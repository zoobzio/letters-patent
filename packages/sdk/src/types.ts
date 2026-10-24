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
) => User<Meta<C>> | Promise<User<Meta<C>>>;

/**
 * An out-of-band continuation: the flow proceeds at `location`, outside
 * letters-patent. A redirect-based provider returns one from `login` (the
 * authorization URL at the auth host) and from `callback` (the in-app path
 * to land on once the session is established). The host — the server
 * handlers of an integration — turns it into an HTTP answer; the service
 * itself never navigates.
 */
export interface Redirect {
  location: string;
}

/**
 * The interaction contract between letters-patent and an authentication service.
 * letters-patent never implements authentication — a provider wraps a particular
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
   * untouched and returns the {@link Redirect} to continue at — `callback`
   * or `resolve` picks the session up when the flow returns.
   */
  login(state: State<C>, schema: Schema<C>): Promise<void | Redirect>;

  /**
   * Complete an out-of-band login: the return leg of a redirect-based flow,
   * reached when the auth host sends the browser back. Consumes whatever
   * the host handed over (an authorization code, a token) from the
   * provider's own request context, establishes the session, assigns
   * `state.current`, and returns the in-app {@link Redirect} to land on.
   * Driven by an integration's server handlers, never by the service.
   */
  callback?(state: State<C>, schema: Schema<C>): Promise<void | Redirect>;

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
