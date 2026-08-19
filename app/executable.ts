import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

import type { Redirection } from "./types.ts";

/**
 * Find the first executable named `command` in a PATH value.
 *
 * Lookup is deliberately separate from execution: `type` needs to report where
 * a command would run without running it, and completion will eventually need
 * similar PATH knowledge.
 *
 * PATH is a parameter so callers and tests can supply their own search path
 * instead of depending on the environment of the machine running the code.
 */
export function findExecutable(
  command: string,
  pathValue = process.env.PATH ?? "",
): string | undefined {
  const directories = pathValue.split(delimiter);

  for (const directory of directories) {
    if (!directory) continue;

    const candidatePath = join(directory, command);

    try {
      accessSync(candidatePath, constants.X_OK);
      return candidatePath;
    } catch {
      // Continue searching the remaining PATH entries.
    }
  }

  return undefined;
}

/**
 * Launch a resolved executable, preserving the argument boundaries the parser
 * established.
 *
 * `args` is never joined back into a string: that would make `"two words"`
 * indistinguishable from two separate arguments and invite another shell to
 * reinterpret metacharacters.
 *
 * spawnSync blocks, which matches the REPL's model — the next prompt appears
 * after the command exits.
 *
 * TODO(redirection): translate `redirections` into the child's stdio rather
 * than inheriting all three streams. This is the only module that owns
 * child-process mechanics, so it is the only place that needs to.
 */
export function runExecutable(
  executablePath: string,
  args: string[],
  redirections: Redirection[] = [],
): void {
  spawnSync(executablePath, args, { stdio: "inherit" });
}
