import { createInterface } from "readline";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "$ ",
});

// TODO: Uncomment the code below to pass the first stage
rl.prompt();

const inputListener: Parameters<typeof rl.on>[1] = (command) => {
    dispatch(command);

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

const COMMANDS = ['echo', 'exit', '__NONE__'] as const;
type Command = typeof COMMANDS[number];

function parseCommand(input: string): { command: Command, args: string[] } {
  const [command, ...args] = input.split(" ");

  return { command, args };
}

function dispatch(input: string) {
    switch (input) {
        case "exit": {
            rl.close();
            return;
        }

        default: {
            console.log(`${input}: command not found`);
            return;
        }
    }
}


app/
  main.ts        # wiring only: build the real ShellIO, start the repl
  repl.ts        # owns rl + prompt lifecycle; the ONLY importer of readline
  parse.ts       # string -> ParsedCommand (pure)
  builtins/
    index.ts     # registry + Builtin type
    echo.ts exit.ts
  types.ts       # ShellIO, Handler, ParsedCommand
