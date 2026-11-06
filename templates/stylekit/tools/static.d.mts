// Types for static.mjs (the Style Kit's static checks, shared with the app's import).
export type Severity = 'high' | 'medium' | 'low' | 'info';
export interface Finding {
  /** the check id: manifest files contract banned text sample looks prompts credits fonts version (render checks: boot layout frames mustfail export repeat controls) */
  id: string;
  sev: Severity;
  where: { file?: string | null; line?: number | null; view?: string | null; aspect?: string | null; t?: number | null };
  /** what was found */ finding: string;
  /** what it means for the member */ meaning: string;
  /** the exact fix */ fix: string;
}
export interface StaticOpts {
  /** the manifest schema (app: zod parseManifest; kit: style.schema.json) */
  validateManifest?: (raw: any) => { ok: boolean; why?: string };
  /** one look file against the package's controls (app: parseLook + controlsFor + validateByControls) */
  validateLook?: (raw: any, manifest: any) => { ok: boolean; why?: string };
  /** the base's engine folder (engine.js models.js lib/ fonts/ vendor/ ...): exports, identical files, base assets */
  baseEngineDir?: string;
  /** the base's skill folder (reserved: skill/base comparisons) */
  baseSkillDir?: string;
  /** the base's Studio sample folder (its assets count as the base's, not the style's) */
  baseSampleDir?: string;
  /** this app's ENGINE_VERSION of the base (version info finding when newer than the package's from.engineVersion) */
  baseEngineVersion?: number;
  /** the base engine's ENGINE_KIND (default: read from baseEngineDir/engine.js) */
  baseKind?: string;
  /** the base's display name in findings (e.g. "Flat explainer") */
  baseName?: string;
}
export const HOST_CONTRACT: { readonly required: readonly string[]; readonly optional: readonly string[] };
export const BASES: readonly string[];
export const ALWAYS_BANNED: readonly string[];
export const ALLOWED_EXT: readonly string[];
export const LIMITS: { readonly totalBytes: number; readonly fileBytes: number; readonly files: number };
export const MIXAMO_HASHES: readonly string[];
/** base -> check id -> { upTo: base ENGINE_VERSION, why } : faults of the base engine itself, not blocking styles built on it */
export const BASE_DEBT: Readonly<Record<string, Readonly<Record<string, { readonly upTo: number; readonly why: string }>>>>;
export function baseDebt(base: string, id: string, engineVersion: number | null | undefined): { readonly upTo: number; readonly why: string } | null;
export const MEANING: Readonly<Record<string, string>>;
/** the meaning half of each render finding (boot layout frames mustfail export repeat controls) */
export const RENDER_MEANING: Readonly<Record<string, string>>;
/** severity per engine layout issue type (lower-case); QUALITY.md "severity X: ..." lines may only raise it (layoutSeverity) */
export const LAYOUT_SEVERITY: Readonly<Record<string, 'high' | 'medium' | 'low'>>;
/** the built-in severity of a layout / frame finding type, or the declared one when that is higher (never lower) */
export function layoutSeverity(type: string, declared?: Readonly<Record<string, string>>): 'high' | 'medium' | 'low';
/** QUALITY.md text -> { type: severity } of its "- severity <TYPE>: high|medium|low" lines */
export function declaredSeverities(text: string | null | undefined): Record<string, 'high' | 'medium' | 'low'>;
/** BLANK's measure limits and the measure itself (64-px-wide luma, row-major) */
export const BLANK_LIMIT: { readonly full: number; readonly centre: number; readonly floor: number; readonly margin: number };
export function structureOf(L: ArrayLike<number>, w?: number): { full: number; centre: number; blank: boolean };
/** repeat: moments per sample (one per shot, at most this many); pixels changed by > 48 levels that make it high */
export const REPEAT_MAX: number;
export const REPEAT_HUGE_PX: number;
export const REPEAT_BIG_FRAC: number;
/** one moment per sample shot middle (deduped, at most REPEAT_MAX picked evenly), else 37 % / 71 % */
export function repeatMoments(shots: readonly { t0: number; t1?: number | null }[] | null | undefined, end: number): number[];
/** high: big (share of pixels > 16 levels) > REPEAT_BIG_FRAC or huge (pixels > 48 levels) > REPEAT_HUGE_PX; else low */
export function repeatSeverity(d: { big: number; huge: number }): 'high' | 'low';
/** a sample/views.json "images" entry: what is wrong with it, or null */
export function imageEntryProblem(key: unknown, value: unknown): string | null;
/** licence files without an extension, and the file-name rule a package's files follow */
export const LICENCE_NAME: RegExp;
export function isAllowedFile(rel: string): boolean;
/** [label, pattern] of the calls that reach outside a style (sendBeacon, WebSocket, navigation ...) */
export const NETWORK_BANNED: readonly (readonly [string, RegExp])[];
export const CHARSETS: Readonly<Record<string, string>>;
export function stripJs(src: string, keepStrings?: boolean): string;
export function exportNames(src: string): string[];
export function engineVersionOf(src: string | null | undefined): number | null;
export function engineKindOf(src: string | null | undefined): string | null;
export function bannedInSource(src: string, tokens?: readonly string[]): { token: string; line: number; text: string }[];
export function gluedComments(src: string): { line: number; text: string }[];
export function fontCoverage(buf: Buffer): ((cp: number) => boolean) | null;
export function skippedReason(rel: string): string | null;
export function unsafeName(name: string): string | null;
export function packageRoot(dir: string): string;
export function staticCheck(pkgDir: string, opts?: StaticOpts): Promise<Finding[]>;
export function formatFindings(findings: Finding[]): string;
