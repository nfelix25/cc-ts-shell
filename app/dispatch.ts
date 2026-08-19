import { findBuiltin } from "./builtins/index.ts";
import { findExecutable, runExecutable } from "./executable.ts";
import type { ParsedCommand, Redirection, ShellIO } from "./types.ts";

/**
 * The side-effecting lookups dispatch depends on, injectable so that routing
 * tests can observe a decision without searching the real PATH or spawning a
 * process. Production callers pass nothing and get the defaults below.
 */
export interface DispatchDependencies {
  pathValue: string;
  findExecutable(command: string, pathValue: string): string | undefined;
  runExecutable(
    executablePath: string,
    args: string[],
    redirections: Redirection[],
  ): void;
}

const defaultDependencies: DispatchDependencies = {
  pathValue: process.env.PATH ?? "",
  findExecutable,
  runExecutable,
};

/**
 * Route a parsed command: builtins win, then PATH executables, then failure.
 *
 * Builtins come first because a builtin must override an executable of the same
 * name, and because stateful commands like `cd` and `exit` have to act on this
 * process — a child could never change its parent.
 *
 * This module owns policy (which mechanism wins) while the builtin handlers and
 * executable.ts own the mechanisms. Keeping those apart means new syntax stays
 * out of routing, and routing stays out of the commands.
 *
 * TODO(redirection): apply `command.redirections` here for builtins by handing
 * them a substitute ShellIO. Executables are handled in runExecutable instead,
 * since they receive operating-system stdio when the child process is created.
 */
export function dispatch(
  command: ParsedCommand,
  io: ShellIO,
  overrides: Partial<DispatchDependencies> = {},
): void {
  const dependencies = { ...defaultDependencies, ...overrides };
  const builtin = findBuiltin(command.name);

  if (builtin) {
    builtin(command.args, io);
    return; // Returning stops a PATH executable of the same name from also running.
  }

  const executablePath = dependencies.findExecutable(
    command.name,
    dependencies.pathValue,
  );

  if (executablePath) {
    dependencies.runExecutable(
      executablePath,
      command.args,
      command.redirections,
    );
    return;
  }

  io.writeLine(`${command.name}: not found`);
}
