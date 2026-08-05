import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

// TODO: Uncomment the code below to pass the first stage
rl.prompt();

const inputListener: Parameters<typeof rl.on>[1] = input => {
    handleCommandNotFound(input);
    rl.prompt();
}

rl.on('line', inputListener)

function handleCommandNotFound(input: string) {
    console.log(`${input}: command not found`);
}
