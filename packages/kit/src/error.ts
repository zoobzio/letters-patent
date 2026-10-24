/**
 * Thrown when no config file exists at the path of the build. `path` holds
 * the path the build checked.
 */
export class MissingConfigError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`@letters-patent/kit: no config file at ${path}`);
    this.name = "MissingConfigError";
    this.path = path;
  }
}

/**
 * Thrown when a config file loads but its default export is not a config.
 * `path` holds the path of the file.
 */
export class MalformedConfigError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(
      `@letters-patent/kit: ${path} must default-export a config (defineConfig({ resource }))`,
    );
    this.name = "MalformedConfigError";
    this.path = path;
  }
}

/**
 * Thrown when a config breaks a rule before any document is read. `rule`
 * names the member at fault.
 */
export class InvalidConfigError extends Error {
  readonly rule: string;

  constructor(rule: string, message: string) {
    super(`@letters-patent/kit: ${message}`);
    this.name = "InvalidConfigError";
    this.rule = rule;
  }
}

/**
 * Thrown when a document the build read is not what its standard says it
 * is. `origin` names the document; `path` the member at fault, when one is.
 */
export class InvalidDocumentError extends Error {
  readonly origin: string;
  readonly path: string[];

  constructor(origin: string, message: string, path: string[] = []) {
    const where = path.length > 0 ? ` at ${path.join(".")}` : "";
    super(`@letters-patent/kit: ${origin}${where}: ${message}`);
    this.name = "InvalidDocumentError";
    this.origin = origin;
    this.path = path;
  }
}
