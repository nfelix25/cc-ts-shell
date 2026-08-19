import type { BuiltinHandler } from "../types.ts";

/**
 * End the shell by closing its I/O rather than killing the process.
 *
 * exit expresses a shell action while the REPL owns terminal lifecycle. Going
 * through `io.close()` lets the concrete adapter clean up its listeners, and
 * keeps this builtin testable without ending the test runner.
 */
export const exitBuiltin: BuiltinHandler = (args, io) => {
  io.close();
};
