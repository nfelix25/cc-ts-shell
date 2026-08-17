/**
 * REFACTOR GUIDE — ADDED BY CODEX
 *
 * This file is the working implementation. Refactor it in the numbered order
 * described in docs/REFACTOR_GUIDE.md, keeping the shell runnable after each
 * extraction. Every comment with this marker was added as a guidepost; comments
 * without the marker are your original notes.
 *
 * Target: main.ts eventually imports startRepl() and contains no shell behavior.
 */

import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path, * as nodePath from "node:path";
import type { Interface } from "node:readline";

import { createInterface } from "readline";

// REFACTOR GUIDE — ADDED BY CODEX (step 6 -> app/repl.ts)
// Move this only after parsing, builtins, executables, and dispatch are extracted.
class ShellIO {
  #io: Interface;

  constructor() {
    this.#io = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "$ ",
    });

    this.#io.prompt();
  }

  io() {
    return this.#io;
  }
}

const shell = new ShellIO(),
  rl = shell.io();

// REFACTOR GUIDE — ADDED BY CODEX (step 6 -> app/repl.ts)
// This listener is the integration point: parse one line, dispatch it, then prompt.
const inputListener: Parameters<typeof rl.on>[1] = (input) => {
  const { candidateCommand, args } = parseInput(input);

  dispatch(candidateCommand, args);

  // Prompt the user for the next command if there are still listeners for the "line" event
  if (rl.listenerCount("line") > 0) {
    rl.prompt();
  }
};

const closeListener: Parameters<typeof rl.on>[1] = () => {
  rl.removeListener("line", inputListener);
};

rl.on("line", inputListener);
rl.on("close", closeListener);

// REFACTOR GUIDE — ADDED BY CODEX (steps 1 and 5)
// Replace Function with BuiltinHandler from app/types.ts, then remove Directory
// when app/builtins/index.ts becomes the single registry.
type Directory = {
  [K in "builtins" | "executables"]: Record<string, { handler: Function }>;
};

function expandTilde(candidatePath: string) {
  if (candidatePath === "~") {
    return homedir();
  } else if (candidatePath.startsWith("~/")) {
    return path.join(homedir(), candidatePath.slice(2));
  }
  return candidatePath;
}

// Future classes or expansions

// REFACTOR GUIDE — ADDED BY CODEX (step 4 -> app/builtins/*)
// Move one handler at a time and register each one in app/builtins/index.ts.
// Keep this registry working until dispatch no longer depends on it.
const directory: Directory = {
  builtins: {
    cd: {
      handler: (candidatePath: string) => {
        const resolvedPath = path.resolve(expandTilde(candidatePath));
        const pathExists = existsSync(resolvedPath);

        if (pathExists) {
          const stats = statSync(resolvedPath);

          if (stats.isDirectory()) {
            process.chdir(resolvedPath);
            return;
          }
        }
        console.log(`${candidatePath}: No such file or directory`);
      },
    },
    exit: { handler: () => rl.close() },
    echo: { handler: (output: string) => console.log(output) },
    pwd: { handler: () => console.log(process.cwd()) },
    type: {
      handler: (candidateCommand: string) => {
        const isbuiltinCommand = isBuiltinCommand(candidateCommand);
        if (isbuiltinCommand) {
          console.log(`${candidateCommand} is a shell builtin`);
        } else {
          const executablePath = parseExecutablePath(candidateCommand);

          if (executablePath) {
            handleExecutableCommand(candidateCommand, executablePath);
          } else {
            handleCommandNotFound(candidateCommand);
          }
        }
      },
    },
  },
  // Incorrect pattern but leaving for type example
  executables: {},
};

// REFACTOR GUIDE — ADDED BY CODEX (step 4 -> app/builtins/type.ts)
// This formats `type` output; rename it when moving it so it is not confused
// with actually executing a command.
function handleExecutableCommand(command: string, path: string) {
  console.log(`${command} is ${path}`);
}

// REFACTOR GUIDE — ADDED BY CODEX (step 3 -> app/executable.ts)
// Move PATH lookup before moving dispatch. Keep lookup separate from execution
// because the `type` builtin needs to inspect a command without launching it.
function findExecInPath(dirs: string[], command: string) {
  for (const dir of dirs) {
    if (!dir) continue;

    const candidate = nodePath.join(dir, command);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue searching the remaining PATH entries.
    }
  }

  return undefined;
}

// REFACTOR GUIDE — ADDED BY CODEX (step 5 -> app/dispatch.ts)
// After all builtins use BuiltinHandler, replace this switch with one registry
// lookup followed by the external-command fallback.
function dispatch(command: string, args: string[]) {
  // This should morph into the parser eg echo should send string not string[]
  switch (command) {
    case "cd": {
      const path = parseArgs(args.slice(0, 1));
      directory.builtins.cd.handler(path);
      return;
    }

    case "exit": {
      directory.builtins.exit.handler();
      return;
    }

    case "echo": {
      const output = parseArgs(args);
      directory.builtins.echo.handler(output);
      return;
    }

    case "pwd": {
      directory.builtins.pwd.handler();
      return;
    }

    case "type": {
      const opts = parseArgs(args);
      directory.builtins.type.handler(opts);
      return;
    }

    default: {
      // TODO 1: MOVE INTO OWN FUNCTION, will need to break out of switch since handling possible executable is an entire subset
      const executablePath = parseExecutablePath(command);
      if (executablePath) {
        // spawnSync captures the child's output by default. Using "inherit" connects the
        // child directly to this shell's stdin, stdout, and stderr, so its full output
        // is displayed as it runs instead of being returned as a Buffer.
        spawnSync(command, args, {
          stdio: "inherit",
        });

        // Expected: "Program was passed 4 args (including program name)."
        // [tester::#IP1] Received: "$ null Program was passed 4 args (including program name)."
      } else {
        handleCommandNotFound(command);
      }
      return;
    }
  }
}

// One off functions

// REFACTOR GUIDE — ADDED BY CODEX (step 3 -> app/executable.ts)
// Prefer a final API like findExecutable(command, pathValue). PATH is runtime
// data, so the ColonPath type below does not provide useful safety.
function parseExecutablePath(command: string) {
  const paths = parsePath(process.env.PATH ?? "");
  const executablePath = findExecInPath(paths, command);
  return executablePath;
}

type IsColonPath<S extends string> = S extends ""
  ? false
  : S extends `${infer Head}:${infer Tail}`
    ? Head extends ""
      ? false
      : IsColonPath<Tail>
    : S extends ""
      ? false
      : true;
type ColonPath<S extends string> = IsColonPath<S> extends true ? S : never;

function parsePath<T extends string>(path: ColonPath<T>) {
  return path.split(":");
}

// DONE FOR THE CHALLENGE ONLY
// SHOULD BE USING EXECSYNC AND THE DIReCT COMMAND STRING TO AVOID PARSE
// REFACTOR GUIDE — ADDED BY CODEX (step 2 -> app/parse.ts)
// Move this function unchanged first and add characterization tests. Rename
// candidateCommand to name only after the extraction is green.
function parseInput(input: string): {
  candidateCommand: string;
  args: string[];
} {
  const inputSplitOnFirstSpace = input.split(/ (.*)/s);

  const candidateCommand = inputSplitOnFirstSpace[0];

  const parseCommandWithQuotes = new Set(["'", '"']).has(candidateCommand[0]);

  const argString = `${parseCommandWithQuotes ? candidateCommand : ""}${inputSplitOnFirstSpace[1] ? ` ${inputSplitOnFirstSpace[1]}` : ""}`;

  const args: string[] = [],
    quoteIndices: number[][] = [];

  let currentArg = "",
    currentlyEscaping = false;

  for (let i = 0; i < argString?.length; i++) {
    const currentChar = argString[i],
      isSpace = currentChar === " ",
      isQuote = currentChar === "'" || currentChar === '"',
      isSlash = currentChar === "\\",
      currentQuoteIndex = quoteIndices[quoteIndices.length - 1],
      isCurrentQuoteUnmatched = currentQuoteIndex?.length === 1;

    if (currentlyEscaping) {
      currentArg += currentChar;
      currentlyEscaping = false;
      continue;
    }

    if (isSlash && !isCurrentQuoteUnmatched) {
      currentlyEscaping = true;
      continue;
    }

    if (isCurrentQuoteUnmatched && argString[currentQuoteIndex[0]] === '"') {
      if (isSlash) {
        const escapableCharWithinDoubles = new Set(['"', "\\", "$", "`", "\n"]);
        if (escapableCharWithinDoubles.has(argString[i + 1])) {
          currentlyEscaping = true;
          continue;
        }
      }
    }

    if (isSpace) {
      if (!isCurrentQuoteUnmatched) {
        if (currentArg) {
          args.push(currentArg);
        }
        currentArg = "";
      } else {
        currentArg += " ";
      }
      continue;
    }

    if (isQuote) {
      if (!isCurrentQuoteUnmatched) {
        quoteIndices.push([]);
      } else if (currentChar != argString[currentQuoteIndex[0]]) {
        currentArg += currentChar;
        continue;
      }
      quoteIndices[quoteIndices.length - 1].push(i);
    } else {
      currentArg += currentChar;
    }
  }

  if (currentArg) {
    args.push(currentArg);
  }

  return {
    candidateCommand: parseCommandWithQuotes ? args[0] : candidateCommand,
    args: parseCommandWithQuotes ? args.slice(1) : args,
  };
}

// REFACTOR GUIDE — ADDED BY CODEX (step 7 cleanup)
// Remove this after handlers receive string[] and join only when their own
// behavior requires it (for example, echo).
function parseArgs(args: string[]): string {
  return args.join(" ");
}

// REFACTOR GUIDE — ADDED BY CODEX (steps 4-5 -> app/builtins/index.ts)
// Both `type` and dispatch should query the same builtin registry.
function isBuiltinCommand(candidateBuiltinCommand: string) {
  return candidateBuiltinCommand in directory.builtins;
}

// REFACTOR GUIDE — ADDED BY CODEX (step 5 -> app/dispatch.ts)
// Command-not-found is a routing outcome, so keep its output beside dispatch.
function handleCommandNotFound(command: string) {
  console.log(`${command}: not found`);
}
