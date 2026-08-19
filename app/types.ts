/**
 * A destination a shell command can write to.
 *
 * stdout and stderr have different jobs and can be redirected independently.
 * Naming the channel is safer than scattering the numeric file descriptors
 * (`1` and `2`) through otherwise high-level shell code.
 */
export type OutputChannel = "stdout" | "stderr";

/** Whether a redirection replaces a file or adds to the end of it. */
export type RedirectionMode = "overwrite" | "append";

/**
 * A parsed redirection, ready for dispatch or execution to apply.
 *
 * Syntax belongs at the parser boundary: `2>>` is spelling, while
 * `{ channel: "stderr", mode: "append" }` is meaning. Once an operator is
 * represented as data, dispatch and execution can focus on applying it instead
 * of knowing how the user typed it.
 */
export interface Redirection {
  channel: OutputChannel;
  mode: RedirectionMode;
  target: string;
}

/**
 * The parser's complete description of one command line.
 *
 * Keeping `args` as an array preserves the word boundaries established by
 * quoting and escaping; rebuilding a command string would throw that work away.
 */
export interface ParsedCommand {
  name: string;
  args: string[];
  redirections: Redirection[];
}

/**
 * The small slice of terminal I/O that builtins are allowed to use.
 *
 * Builtins need the ability to produce output, not access to an entire readline
 * object. Depending on this narrower capability keeps tests cheap and lets
 * redirection replace the destination without changing any builtin.
 *
 * `channel` defaults to stdout in concrete implementations.
 */
export interface ShellIO {
  writeLine(line: string, channel?: OutputChannel): void;
  close(): void;
}

/**
 * Every builtin receives already-parsed arguments and shell-owned I/O.
 *
 * One handler shape turns builtin selection into a registry lookup, which gives
 * dispatch polymorphism without a class hierarchy.
 */
export type BuiltinHandler = (args: string[], io: ShellIO) => void;
