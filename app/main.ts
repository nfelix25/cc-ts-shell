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

type Directory = {
  [K in "builtins" | "executables"]: Record<string, { handler: Function }>;
};
const directory: Directory = {
  builtins: {
    exit: { handler: () => rl.close() },
    echo: { handler: (output: string) => console.log(output) },
    type: {
      handler: (candidateCommand: string) => {
        console.log(process.env);
        const commandExists = isCommand(candidateCommand);
        if (commandExists) {
          const commandType = isBuiltinCommand(candidateCommand)
            ? "builtin"
            : "executable";
          console.log(`${candidateCommand} is a shell ${commandType}`);
        } else {
          handleCommandNotFound(candidateCommand);
        }
      },
    },
  },
  executables: {},
};

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

function handleCommandNotFound(command: string) {
  console.log(`${command}: not found`);
}
