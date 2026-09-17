/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — P17/P22 source-firewall scanners.
 *
 * WHY THIS MODULE EXISTS: the audited version of both checks was degenerate. P17
 * audited a hardcoded list of four file names and P22 asked whether a *line*
 * containing a forbidden fragment ALSO contained one of four read tokens, so a
 * multiline `import { … } from` or an `await import(…)` slipped through. Both
 * are replaced here by source-level analysis:
 *
 *   * comments are stripped with a string-aware scanner (a fragment inside a
 *     comment is not a dependency, and a fragment inside a string is not
 *     mistaken for a comment);
 *   * every string literal is extracted WITH its enclosing statement, so a
 *     specifier is found no matter how it is written — `import x from`, a
 *     multiline `import {\n…\n} from`, `await import(`, `require(`, `readFile`,
 *     `readFileSync`, `fs.promises.readFile` or a bare path literal;
 *   * P17 scans the WHOLE runtime execution closure, enumerated from the
 *     directory at run time, instead of a hardcoded file list.
 *
 * Honest limitation, disclosed rather than hidden: a path assembled from
 * non-literal pieces at run time (e.g. `"belief-causal-" + "validation-v0"`)
 * cannot be caught by any static source scan, and neither check is a sandbox.
 * What they do guarantee is that no *literal* V0 outcome path and no writer
 * call token exists in the audited closure.
 */

export interface SourceFile {
  readonly file: string;
  readonly code: string;
}

export type SpecifierKind =
  | "STATIC_IMPORT"
  | "MULTILINE_IMPORT"
  | "SIDE_EFFECT_IMPORT"
  | "DYNAMIC_IMPORT"
  | "REQUIRE"
  | "READ_FILE"
  | "LITERAL";

export interface StringLiteral {
  readonly text: string;
  readonly kind: SpecifierKind;
  /** The enclosing statement, whitespace-collapsed and truncated for evidence. */
  readonly statement: string;
  /** [start, end) offsets into the comment-stripped source. */
  readonly start: number;
  readonly end: number;
}

/**
 * Removes comments without trusting line structure: quote and template state is
 * tracked so `//` inside a string and a quote inside a comment are both handled.
 */
export function stripCommentsForAudit(source: string): string {
  const out: string[] = [];
  let index = 0;
  const length = source.length;
  const quoteOpeners = new Set(["'", '"', "`"]);
  while (index < length) {
    const char = source[index] as string;
    const next = source[index + 1];
    if (char === "/" && next === "*") {
      index += 2;
      while (index < length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 2;
      out.push(" ");
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < length && source[index] !== "\n") index += 1;
      continue;
    }
    if (quoteOpeners.has(char)) {
      const close = char;
      let cursor = index + 1;
      let closed = false;
      while (cursor < length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === close) {
          closed = true;
          break;
        }
        cursor += 1;
      }
      if (!closed) {
        // An unterminated quote is not a string (a stray regex/character
        // literal): emit it as ordinary code so nothing is silently swallowed.
        out.push(char);
        index += 1;
        continue;
      }
      out.push(source.slice(index, cursor + 1));
      index = cursor + 1;
      continue;
    }
    out.push(char);
    index += 1;
  }
  return out.join("");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The statement prefix in front of a literal: everything after the previous
 * statement terminator. Newlines are deliberately NOT boundaries — a multiline
 * `import { … } from` and a `readFileSync(join(root, …))` argument list both
 * span lines, and treating a newline as a statement end is exactly the defect
 * that let the multiline import slip past the audited check.
 */
function statementPrefixBefore(code: string, offset: number): string {
  const start = code.lastIndexOf(";", offset - 1) + 1;
  return code.slice(start, offset);
}

/**
 * Extracts every string literal with its enclosing statement. The statement text
 * is what the classification runs on, so a specifier written across several
 * lines is still one statement.
 */
export function extractStringLiterals(code: string): readonly StringLiteral[] {
  const literals: StringLiteral[] = [];
  let index = 0;
  const length = code.length;
  while (index < length) {
    const char = code[index] as string;
    if (char !== "'" && char !== '"' && char !== "`") {
      index += 1;
      continue;
    }
    const close = char;
    let cursor = index + 1;
    let closed = false;
    while (cursor < length) {
      if (code[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (code[cursor] === close) {
        closed = true;
        break;
      }
      cursor += 1;
    }
    if (!closed) {
      index += 1;
      continue;
    }
    const text = code.slice(index + 1, cursor);
    const rawPrefix = statementPrefixBefore(code, index);
    const statement = collapse(`${rawPrefix}${code.slice(index, cursor + 1)}`);
    literals.push({
      text,
      kind: classifySpecifier(rawPrefix),
      statement: statement.length > 240 ? `${statement.slice(0, 240)}…` : statement,
      start: index,
      end: cursor + 1
    });
    index = cursor + 1;
  }
  return literals;
}

/**
 * Classifies a literal by what precedes it. The kind is reported for evidence
 * quality only: the firewall fails on ANY literal containing a forbidden
 * fragment, whatever construct produced it.
 */
function classifySpecifier(rawPrefix: string): SpecifierKind {
  const prefix = collapse(rawPrefix);
  if (/\bfrom$/.test(prefix)) {
    // An import whose `import` keyword and `from` keyword sit on different lines
    // is the multiline form the audited check could not see.
    return /\bimport\b[\s\S]*\n[\s\S]*\bfrom\s*$/.test(rawPrefix) ? "MULTILINE_IMPORT" : "STATIC_IMPORT";
  }
  if (/\bimport$/.test(prefix)) return "SIDE_EFFECT_IMPORT";
  if (/\bimport\s*\($/.test(prefix) || /\bawait\s+import\s*\($/.test(prefix)) return "DYNAMIC_IMPORT";
  if (/\brequire\s*\(/.test(prefix)) return "REQUIRE";
  if (/\breadFileSync\s*\(|\breadFile\s*\(|promises\.readFile\s*\(/.test(prefix)) return "READ_FILE";
  return "LITERAL";
}

/** The declared V0 firewall span: the ONLY place a V0 outcome path may appear. */
function declaredFirewallSpan(code: string): { readonly start: number; readonly end: number } | null {
  const marker = code.indexOf("V0_FIREWALL");
  if (marker < 0) return null;
  const arrayStart = code.indexOf("[", code.indexOf("forbidden_reads", marker));
  if (arrayStart < 0) return null;
  const arrayEnd = code.indexOf("]", arrayStart);
  if (arrayEnd < 0) return null;
  return { start: arrayStart, end: arrayEnd + 1 };
}

export interface V0FirewallReport {
  readonly passed: boolean;
  readonly read_or_import_violations: readonly {
    readonly file: string;
    readonly kind: SpecifierKind;
    readonly fragment: string;
    readonly statement: string;
    readonly line: number;
  }[];
  readonly files_scanned: readonly string[];
  readonly execution_modules_scanned: readonly string[];
  readonly declared_paths_present: boolean;
  readonly declared_fragment_count: number;
  readonly limitation: string;
}

/** The distinctive token of every V0 outcome artifact path in this repository. */
const V0_EXPERIMENT_TOKEN = ["belief-causal", "validation", "v0"].join("-");
export const V0_FIREWALL_FRAGMENTS: readonly string[] = Object.freeze([
  V0_EXPERIMENT_TOKEN,
  ["V0", "PRIMARY"].join("_"),
  ["V0", "REPLICATION"].join("_")
]);

export const V0_STATIC_SCAN_LIMITATION =
  "static literal analysis only: a path assembled from non-literal pieces at run time cannot be detected; this audit is not a sandbox";

/** Runtime execution modules: enumerated from disk, NEVER a hardcoded file list. */
export const EXECUTION_CLOSURE_PATTERN = /^calibration-.*\.ts$|^cli\.ts$/;

/** The modules that MUST be present, so a silently-empty closure cannot pass. */
export const REQUIRED_EXECUTION_MODULES: readonly string[] = Object.freeze([
  "calibration-authority.ts",
  "calibration-evidence.ts",
  "calibration-law.ts",
  "calibration-request.ts",
  "calibration-runner.ts",
  "calibration-transport.ts",
  "cli.ts"
]);

/**
 * Extracts a top-level function body by brace matching. A regex over `[\s\S]*?\n\}`
 * stops at the FIRST closing brace, which is not the end of a function whose body
 * contains nested blocks — the audited body would silently shrink.
 */
export function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) return "";
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}

function lineOf(code: string, offset: number): number {
  return code.slice(0, offset).split("\n").length;
}

/**
 * P22: no source in the scanned set may contain a literal V0 outcome path, in any
 * construct — static or multiline import, dynamic import, require, readFile,
 * readFileSync, fs.promises.readFile, or a bare path literal.
 */
export function auditV0DependencyFree(input: {
  readonly files: readonly SourceFile[];
  readonly declaredFirewallPaths: readonly string[];
  readonly executionModulePattern: RegExp;
  readonly requireDeclaredFirewall: boolean;
}): V0FirewallReport {
  const violations: V0FirewallReport["read_or_import_violations"][number][] = [];
  const declaredSpans = new Map<string, { start: number; end: number }>();
  for (const entry of input.files) {
    const span = declaredFirewallSpan(stripCommentsForAudit(entry.code));
    if (span !== null) declaredSpans.set(entry.file, span);
  }
  for (const entry of input.files) {
    const code = stripCommentsForAudit(entry.code);
    const span = declaredSpans.get(entry.file);
    for (const literal of extractStringLiterals(code)) {
      for (const fragment of V0_FIREWALL_FRAGMENTS) {
        if (!literal.text.includes(fragment)) continue;
        // A declared firewall entry inside the declared span of the file that
        // declares it is a DECLARATION, not a read.
        const declaredHere =
          span !== undefined &&
          literal.start >= span.start &&
          literal.end <= span.end &&
          input.declaredFirewallPaths.some((declared) => literal.text.includes(declared.slice(declared.lastIndexOf("/") + 1)));
        if (declaredHere) continue;
        violations.push({
          file: entry.file,
          kind: literal.kind,
          fragment,
          statement: literal.statement,
          line: lineOf(code, literal.start)
        });
      }
    }
  }
  const executionModulesScanned = input.files
    .filter((entry) => input.executionModulePattern.test(entry.file))
    .map((entry) => entry.file);
  const declaredFragments = input.declaredFirewallPaths.map((path) => path.slice(path.lastIndexOf("/") + 1));
  const declaredFound: string[] = [];
  for (const [file, span] of declaredSpans) {
    const entry = input.files.find((candidate) => candidate.file === file);
    if (entry === undefined) continue;
    for (const literal of extractStringLiterals(stripCommentsForAudit(entry.code))) {
      if (literal.start < span.start || literal.end > span.end) continue;
      for (const fragment of declaredFragments) if (literal.text.includes(fragment)) declaredFound.push(fragment);
    }
  }
  const declaredPresent =
    !input.requireDeclaredFirewall ||
    (declaredSpans.size > 0 && declaredFragments.every((fragment) => declaredFound.includes(fragment)));
  return {
    passed: violations.length === 0 && executionModulesScanned.length > 0 && declaredPresent,
    read_or_import_violations: violations,
    files_scanned: input.files.map((entry) => entry.file),
    execution_modules_scanned: executionModulesScanned,
    declared_paths_present: declaredPresent,
    declared_fragment_count: declaredFragments.length,
    limitation: V0_STATIC_SCAN_LIMITATION
  };
}

/**
 * The exclusion ranges of a literal's CONTENT. For `'`/`"` strings that is the
 * whole content. For a template literal the `${ … }` expressions are CODE and are
 * deliberately NOT excluded, so a writer call hidden inside an interpolation is
 * still scanned.
 */
function literalExclusionRanges(code: string, literal: StringLiteral): readonly (readonly [number, number])[] {
  const contentStart = literal.start + 1;
  const contentEnd = literal.end - 1;
  if (code[literal.start] !== "`") return [[contentStart, contentEnd]];
  const ranges: (readonly [number, number])[] = [];
  let segmentStart = contentStart;
  let cursor = contentStart;
  while (cursor < contentEnd) {
    if (code[cursor] === "$" && code[cursor + 1] === "{") {
      ranges.push([segmentStart, cursor]);
      let depth = 1;
      let index = cursor + 2;
      while (index < contentEnd && depth > 0) {
        if (code[index] === "{") depth += 1;
        else if (code[index] === "}") depth -= 1;
        index += 1;
      }
      cursor = index;
      segmentStart = index;
      continue;
    }
    cursor += 1;
  }
  ranges.push([segmentStart, contentEnd]);
  return ranges;
}

/**
 * Occurrences of `token` in EXECUTABLE code. A token inside a string literal is
 * data — an audit vocabulary, an error message, a documented name — not a call
 * site, and treating it as one makes the audit report call sites that do not
 * exist. The `${…}` of a template literal stays in scope.
 */
export function tokenHitsInCode(code: string, token: string): readonly number[] {
  const exclusions: (readonly [number, number])[] = [];
  for (const literal of extractStringLiterals(code)) exclusions.push(...literalExclusionRanges(code, literal));
  const hits: number[] = [];
  let from = 0;
  for (;;) {
    const at = code.indexOf(token, from);
    if (at < 0) break;
    from = at + token.length;
    const insideLiteralContent = exclusions.some(([start, end]) => at >= start && at < end);
    if (!insideLiteralContent) hits.push(at);
  }
  return hits;
}

export interface WriterFirewallReport {
  readonly passed: boolean;
  readonly violations: readonly { readonly file: string; readonly token: string; readonly line: number; readonly statement: string }[];
  readonly intervention_body_writer_violations: readonly string[];
  readonly execution_closure: readonly string[];
  readonly missing_required_modules: readonly string[];
  readonly offline_formation_files: readonly string[];
  readonly durable_stable: boolean;
  readonly detail: string;
  /** Filled in by the caller that actually MEASURES durable immutability. */
  readonly durable_measurement?: Readonly<Record<string, unknown>>;
}

/** Writer/commit/canonical-mutation tokens that must not appear in the execution closure. */
export const WRITER_TOKENS: readonly string[] = Object.freeze([
  "commitReserved",
  "reserveAndRoute",
  "terminalizeReservedNoOp",
  "writeBelief",
  "BeliefTransitionExecutor",
  "runForEpisodeRefs",
  "createInMemorySubjectCoreFacade",
  "AtomicCommitBundle",
  "commitBundle"
]);

/**
 * P17: the calibration EXECUTION closure (calibration-*.ts + the CLI entry
 * points, enumerated from disk) must contain no writer/commit token, while the
 * offline formation files are allowed to form histories — that is their whole
 * purpose — and are reported separately. The frozen body tokens are kept, and
 * durable belief items must hash identically before and after every
 * research-side intervention.
 */
export function auditInterventionWriterFree(input: {
  readonly interventionBody: string;
  readonly renderBody: string;
  readonly executionClosure: readonly SourceFile[];
  readonly requiredExecutionModules: readonly string[];
  readonly offlineFormationFiles: readonly string[];
  readonly durableBefore: { readonly low: string; readonly high: string };
  readonly durableAfter: { readonly low: string; readonly high: string };
}): WriterFirewallReport {
  const bodyTokens = ["commitReserved", "reserveAndRoute", "terminalizeReservedNoOp", "writeBelief"];
  const interventionBodyViolations = bodyTokens.filter(
    (token) =>
      tokenHitsInCode(input.interventionBody, token).length > 0 || tokenHitsInCode(input.renderBody, token).length > 0
  );
  const violations: { file: string; token: string; line: number; statement: string }[] = [];
  for (const entry of input.executionClosure) {
    const code = stripCommentsForAudit(entry.code);
    for (const token of WRITER_TOKENS) {
      for (const at of tokenHitsInCode(code, token)) {
        violations.push({
          file: entry.file,
          token,
          line: lineOf(code, at),
          statement: collapse(code.slice(code.lastIndexOf(";", at - 1) + 1, at + token.length)).slice(0, 200)
        });
      }
    }
  }
  const closureFiles = input.executionClosure.map((entry) => entry.file);
  const missing = input.requiredExecutionModules.filter((module) => !closureFiles.includes(module));
  const durableStable =
    input.durableBefore.low === input.durableAfter.low && input.durableBefore.high === input.durableAfter.high;
  return {
    passed:
      interventionBodyViolations.length === 0 &&
      violations.length === 0 &&
      missing.length === 0 &&
      input.interventionBody.length > 0 &&
      input.renderBody.length > 0 &&
      input.executionClosure.length > 0 &&
      durableStable,
    violations,
    intervention_body_writer_violations: interventionBodyViolations,
    execution_closure: closureFiles,
    missing_required_modules: missing,
    offline_formation_files: input.offlineFormationFiles,
    durable_stable: durableStable,
    detail:
      "no writer/commit token exists in the enumerated calibration execution closure; history formation is confined to the offline formation files listed here and is never reachable from the network path"
  };
}
