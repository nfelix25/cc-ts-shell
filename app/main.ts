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
