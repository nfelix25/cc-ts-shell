import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

// TODO: Uncomment the code below to pass the first stage
rl.prompt();

const inputListener: Parameters<typeof rl.on>[1] = (input) => {
  const { command, args } = parseInput(input);

  dispatch(command, args);

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

function parseInput(input: string): { command: string; args: string[] } {
  const [command, ...args] = input.split(" ");

  return { command, args };
}

function dispatch(command: string, args: string[]) {
  // This should morph into the parser eg echo should send string not string[]
  switch (command) {
    case "exit": {
      handlers.exit();
      return;
    }

    case "echo": {
      const output = parseArgs(args);
      handlers.echo(output);
      return;
    }

    default: {
      console.log(`${command}: command not found`);
      return;
    }
  }
}

function parseArgs(args: string[]): string {
  return args.join(" ");
}

const handlers = {
  exit: () => rl.close(),
  echo: (output: string) => console.log(output),
};

// app/
//   main.ts        # wiring only: build the real ShellIO, start the repl
//   repl.ts        # owns rl + prompt lifecycle; the ONLY importer of readline
//   parse.ts       # string -> ParsedCommand (pure)
//   builtins/
//     index.ts     # registry + Builtin type
//     echo.ts exit.ts
//   types.ts       # ShellIO, Handler, ParsedCommand
