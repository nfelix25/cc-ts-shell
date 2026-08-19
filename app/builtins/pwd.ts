import type { BuiltinHandler } from "../types.ts";

/**
 * Report the shell process's current working directory.
 *
 * The working directory is state owned by this process. pwd observes it and cd
 * changes it, so both go through the same process-level API.
 */
export const pwdBuiltin: BuiltinHandler = (args, io) => {
  io.writeLine(process.cwd());
};
