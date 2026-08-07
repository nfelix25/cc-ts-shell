import { access, constants } from "fs/promises";
import * as nodePath from "node:path";

import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

// TODO: Uncomment the code below to pass the first stage
rl.prompt();

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

// Future classes or expansions

const directory: Directory = {
  builtins: {
    exit: { handler: () => rl.close() },
    echo: { handler: (output: string) => console.log(output) },
    type: {
      handler: (candidateCommand: string) => {
        const commandExists = isCommand(candidateCommand);
        if (commandExists) {
          if (isBuiltinCommand(candidateCommand)) {
            console.log(`${candidateCommand} is a shell builtin`);
          } else {
            const paths = parsePath(process.env.PATH ?? "");
            const executable = findExecInPath(paths, candidateCommand);
            console.log(executable);
          }
        } else {
          handleCommandNotFound(candidateCommand);
        }
      },
    },
  },
  // Incorrect pattern but leaving for type example
  executables: {},
};

async function findExecInPath(dirs: string[], command: string) {
  for (const dir in dirs) {
    if (!dir) continue;

    const candidate = nodePath.join(dir, command);

    if (
      await access(candidate, constants.X_OK).then(
        () => true,
        () => false,
      )
    ) {
      return candidate;
    }
  }

  return undefined;
}

function dispatch(command: string, args: string[]) {
  // This should morph into the parser eg echo should send string not string[]
  switch (command) {
    case "exit": {
      directory.builtins.exit.handler();
      return;
    }

    case "echo": {
      const output = parseArgs(args);
      directory.builtins.echo.handler(output);
      return;
    }

    case "type": {
      const command = parseArgs(args);
      directory.builtins.type.handler(command);
      return;
    }

    default: {
      handleCommandNotFound(command);
      return;
    }
  }
}

// One off functions

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

function parseInput(input: string): {
  candidateCommand: string;
  args: string[];
} {
  const [candidateCommand, ...args] = input.split(" ");

  return { candidateCommand, args };
}

function parseArgs(args: string[]): string {
  return args.join(" ");
}

function isCommand(candidateCommand: string) {
  return (
    isBuiltinCommand(candidateCommand) || isExecutableCommand(candidateCommand)
  );
}

function isBuiltinCommand(candidateBuiltinCommand: string) {
  return candidateBuiltinCommand in directory.builtins;
}
function isExecutableCommand(candidateExecutableCommand: string) {
  return candidateExecutableCommand in directory.builtins;
}

function handleCommandNotFound(command: string) {
  console.log(`${command}: not found`);
}
