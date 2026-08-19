import type { BuiltinHandler } from "../types.ts";

/**
 * Write the arguments back, separated by single spaces.
 *
 * echo does no parsing of its own: quote characters and escapes are syntax and
 * belong to parse.ts. By the time echo runs it sees only the values the user
 * meant, so no quoting rules are duplicated across builtins.
 */
export const echoBuiltin: BuiltinHandler = (args, io) => {
  io.writeLine(args.join(" "));
};
