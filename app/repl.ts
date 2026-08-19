import { createInterface } from "node:readline";
import type { Interface } from "node:readline";

import { dispatch } from "./dispatch.ts";
import { parseInput } from "./parse.ts";
import type { OutputChannel, ShellIO } from "./types.ts";

export interface ReplOptions {
  // Defaults keep production startup trivial; options let an integration test
  // supply streams without replacing process-wide stdin/stdout globals.
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  error?: NodeJS.WritableStream;
  prompt?: string;
}

/**
 * Adapt readline and Node's two output streams to the builtin-facing API.
 *
 * readline is infrastructure; builtins are shell behavior. This adapter points
 * the dependency from infrastructure toward the small ShellIO contract, so
 * command code neither knows nor cares how a terminal is implemented.
 */
export class ReadlineShellIO implements ShellIO {
  constructor(
    private readonly readline: Interface,
    private readonly output: NodeJS.WritableStream,
    private readonly error: NodeJS.WritableStream,
  ) {}

  writeLine(line: string, channel: OutputChannel = "stdout"): void {
    const destination = channel === "stderr" ? this.error : this.output;
    destination.write(`${line}\n`);
  }

  close(): void {
    this.readline.close();
  }
}

/**
 * Start the interactive shell: create readline, wrap it in a concrete ShellIO,
 * and connect parsing to dispatch.
 *
 * This is the composition root. Keeping it out of main.ts means lower-level
 * modules can be imported by tests without starting a terminal as a side
 * effect.
 */
export function startRepl(options: ReplOptions = {}): void {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const error = options.error ?? process.stderr;

  const readline = createInterface({
    input,
    output,
    prompt: options.prompt ?? "$ ",
    // TODO(completion): supply a readline `completer` built from the registry's
    // builtinNames() plus matching PATH entries.
  });
  const io = new ReadlineShellIO(readline, output, error);

  const inputListener = (line: string) => {
    const command = parseInput(line);

    // Guard the empty line: dispatching "" would fall through to the executable
    // branch, where join(dir, "") resolves to the PATH directory itself and
    // passes the X_OK check.
    if (command.name) dispatch(command, io);

    // exit closes readline and removes the line listener. Checking first avoids
    // printing a ghost prompt after the user has already asked the shell to end.
    if (readline.listenerCount("line") > 0) readline.prompt();
  };

  const closeListener = () => {
    readline.removeListener("line", inputListener);
  };

  readline.on("line", inputListener);
  readline.on("close", closeListener);
  readline.prompt();
}
