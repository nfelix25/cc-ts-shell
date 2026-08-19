[![progress-banner](https://backend.codecrafters.io/progress/shell/51f1ff58-3ca7-4517-951a-7a91f746dac9)](https://app.codecrafters.io/users/nfelix25?r=2qF)

This is a starting point for TypeScript solutions to the
["Build Your Own Shell" Challenge](https://app.codecrafters.io/courses/shell/overview).

In this challenge, you'll build your own POSIX compliant shell that's capable of
interpreting shell commands, running external programs and builtin commands like
cd, pwd, echo and more. Along the way, you'll learn about shell command parsing,
REPLs, builtin commands, and more.

**Note**: If you're viewing this repo on GitHub, head over to
[codecrafters.io](https://codecrafters.io) to try the challenge.

# Passing the first stage

The entry point for your `shell` implementation is in `app/main.ts`. Study and
uncomment the relevant code, then run the command below to execute the tests on
our servers:

```sh
codecrafters submit
```

Time to move on to the next stage!

## Architecture

The shell is split into small modules: `parse.ts` turns a line into a
`ParsedCommand`, `dispatch.ts` routes it to a builtin or a PATH executable, and
`repl.ts` owns the readline lifecycle. `app/main.ts` only calls `startRepl()`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map, the
reasoning behind each boundary, how to add a builtin, and the handoff into the
redirection and completion stages.

```sh
npm test
npm run typecheck
```

# Stage 2 & beyond

Note: This section is for stages 2 and beyond.

1. Ensure you have `bun (1.3)` installed locally
1. Run `./your_program.sh` to run your program, which is implemented in
   `app/main.ts`.
1. Run `codecrafters submit` to submit your solution to CodeCrafters. Test
   output will be streamed to your terminal.
