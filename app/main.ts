import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path, * as nodePath from "node:path";
import type { Interface } from "node:readline";

import { createInterface } from "readline";

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

function handleExecutableCommand(command: string, path: string) {
  console.log(`${command} is ${path}`);
}

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

function parseArgs(args: string[]): string {
  return args.join(" ");
}

function isBuiltinCommand(candidateBuiltinCommand: string) {
  return candidateBuiltinCommand in directory.builtins;
}

function handleCommandNotFound(command: string) {
  console.log(`${command}: not found`);
}
