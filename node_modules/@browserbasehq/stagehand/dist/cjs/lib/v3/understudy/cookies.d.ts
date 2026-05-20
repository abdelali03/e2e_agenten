import { Cookie, CookieParam, ClearCookieOptions } from "../types/public/context.js";
/**
 * helpers for browser cookie management.
 *
 * Mirrors Playwright's cookie API surface, adapted for direct CDP usage
 * against a single default browser context.
 */
/**
 * Filter cookies by URL matching (domain, path, secure).
 * If `urls` is empty every cookie passes.
 */
export declare function filterCookies(cookies: Cookie[], urls: string[]): Cookie[];
/**
 * Validate and normalise `CookieParam` values before sending to CDP.
 *
 * - Ensures every cookie has either `url` or `domain`+`path`.
 * - When `url` is provided, derives `domain`, `path`, and `secure` from it.
 * - Validates that `sameSite: "None"` is paired with `secure: true`
 *   (browsers silently reject this — we throw early with a clear message).
 */
export declare function normalizeCookieParams(cookies: CookieParam[]): CookieParam[];
/**
 * Map a Cookie or CookieParam to the shape CDP's Storage.setCookies expects.
 * Session cookies (expires === -1) omit the expires field so CDP treats them
 * as session-scoped.
 */
export declare function toCdpCookieParam(c: Cookie | CookieParam): Record<string, unknown>;
/**
 * Returns true if a cookie matches all supplied filter criteria.
 * Undefined filters are treated as "match anything".
 */
export declare function cookieMatchesFilter(cookie: Cookie, options: ClearCookieOptions): boolean;
