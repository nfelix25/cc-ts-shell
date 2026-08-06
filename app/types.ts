// types.ts - knows nothing about readline, process, or node

export interface ShellIO {
  write(line: string): void;
  exit(code: number): void;
}

export type Handler = (args: string[], io: ShellIO) => void;

// `main.ts` is the only file that knows `ShellIO` is really `rl` + `process.stdout`. Handlers import a 2-method interface. Now passing it around doesn't feel dirty, because there's nothing leaking — a handler literally cannot call `rl.close()` or attach a listener behind your back.

// app/
//   main.ts        # wiring only: build the real ShellIO, start the repl
//   repl.ts        # owns rl + prompt lifecycle; the ONLY importer of readline
//   parse.ts       # string -> ParsedCommand (pure)
//   builtins/
//     index.ts     # registry + Builtin type
//     echo.ts exit.ts
//   types.ts       # ShellIO, Handler, ParsedCommand
