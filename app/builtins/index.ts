import type { BuiltinHandler } from "../types.ts";
import { findExecutable } from "../executable.ts";
import { cdBuiltin } from "./cd.ts";
import { echoBuiltin } from "./echo.ts";
import { exitBuiltin } from "./exit.ts";
import { pwdBuiltin } from "./pwd.ts";
import { createTypeBuiltin } from "./type.ts";

// Built here rather than in type.ts so that module never has to import this
// registry, which imports it. `findBuiltin` is a hoisted declaration and the
// arrow does not run until a command is typed, so referring to `builtins`
// before its declaration below is safe — but do not reorder these.
export const typeBuiltin = createTypeBuiltin({
  isBuiltin: (name) => findBuiltin(name) !== undefined,
  findExecutable,
});

/**
 * The shell's single source of truth for builtins.
 *
 * Names and handlers are data here rather than cases in a switch, so adding a
 * builtin is one entry and every consumer — dispatch, `type`, and later
 * completion — observes the same set instead of maintaining parallel lists.
 *
 * Builtins are configuration, not runtime state, so the table is frozen.
 */
export const builtins = Object.freeze({
  cd: cdBuiltin,
  echo: echoBuiltin,
  exit: exitBuiltin,
  pwd: pwdBuiltin,
  type: typeBuiltin,
}) satisfies Readonly<Record<string, BuiltinHandler>>;

export function findBuiltin(name: string): BuiltinHandler | undefined {
  // Object.hasOwn avoids treating inherited names such as `toString` as shell
  // commands. Registry membership should mean an entry we deliberately added.
  return Object.hasOwn(builtins, name)
    ? builtins[name as keyof typeof builtins]
    : undefined;
}

/**
 * The name view of the registry, for consumers that need discovery rather than
 * execution. Returns a fresh array so callers cannot mutate the table.
 */
export function builtinNames(): string[] {
  return Object.keys(builtins);
}
