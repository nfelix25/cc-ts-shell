import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { BuiltinHandler } from "../types.ts";

/**
 * Tilde expansion lives beside cd because no other module needs this rule.
 */
function expandTilde(candidatePath: string): string {
  if (candidatePath === "~") return homedir();
  if (candidatePath.startsWith("~/")) {
    return path.join(homedir(), candidatePath.slice(2));
  }
  return candidatePath;
}

/**
 * Change the shell process's working directory to the first argument.
 *
 * cd must be a builtin: a child process receives a copy of its parent's working
 * directory, so changing the copy could never move the interactive shell. Only
 * a process.chdir() inside this long-lived process works.
 *
 * TODO: distinguish "no such file" from "not a directory" and set a non-zero
 * exit status once the course cares about either.
 */
export const cdBuiltin: BuiltinHandler = (args, io) => {
  const [candidatePath] = args;
  const resolvedPath = path.resolve(expandTilde(candidatePath));
  const pathExists = existsSync(resolvedPath);

  if (pathExists) {
    const stats = statSync(resolvedPath);

    if (stats.isDirectory()) {
      process.chdir(resolvedPath);
      return;
    }
  }
  io.writeLine(`${candidatePath}: No such file or directory`);
};
