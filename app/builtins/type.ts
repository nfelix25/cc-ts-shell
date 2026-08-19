import type { BuiltinHandler } from "../types.ts";

export interface TypeBuiltinDependencies {
  isBuiltin(name: string): boolean;
  findExecutable(name: string): string | undefined;
}

/**
 * Describe how a name would resolve: builtin first, then PATH, then not found.
 *
 * Reporting must never execute. `type` answers a question about resolution, and
 * running the command would turn inspection into arbitrary side effects.
 *
 * The factory exists to break an import cycle — `type` needs to ask the
 * registry whether a name is a builtin, but the registry imports this module to
 * put the handler in its table. Passing both lookups in as arguments is
 * dependency injection at function scale; no container is involved.
 */
export function createTypeBuiltin(
  dependencies: TypeBuiltinDependencies,
): BuiltinHandler {
  return (args, io) => {
    const [name] = args;

    if (dependencies.isBuiltin(name)) {
      io.writeLine(`${name} is a shell builtin`);
      return;
    }

    const executablePath = dependencies.findExecutable(name);

    if (!executablePath) {
      io.writeLine(`${name}: not found`);
      return;
    } else {
      io.writeLine(`${name} is ${executablePath}`);
    }
  };
}
