import type { ParsedCommand } from "./types.ts";

/**
 * Convert one terminal line into a command name, its arguments, and any
 * redirections.
 *
 * The character walk is stateful because whether a space or a backslash is
 * syntax or data depends on the surrounding quote context: a space separates
 * arguments normally, but is literal text inside quotes.
 *
 * `quoteIndices` tracks quote pairs as they open and close. An entry holding a
 * single index is a quote that is still open, which is what makes the current
 * character "inside quotes".
 *
 * This module is pure — it knows nothing about readline, the filesystem, or
 * command execution — so its behavior is fully determined by the input string.
 *
 * TODO(redirection): recognize `>`, `>>`, `2>` and `2>>` when unquoted, drop the
 * operator and its target from `args`, and return them as `redirections`.
 */
export function parseInput(input: string): ParsedCommand {
  const words: string[] = [],
    quoteIndices: number[][] = [];

  let currentWord = "",
    currentlyEscaping = false;

  for (let i = 0; i < input.length; i++) {
    const currentChar = input[i],
      isSpace = currentChar === " ",
      isQuote = currentChar === "'" || currentChar === '"',
      isSlash = currentChar === "\\",
      currentQuoteIndex = quoteIndices[quoteIndices.length - 1],
      isCurrentQuoteUnmatched = currentQuoteIndex?.length === 1;

    if (currentlyEscaping) {
      currentWord += currentChar;
      currentlyEscaping = false;
      continue;
    }

    if (isSlash && !isCurrentQuoteUnmatched) {
      currentlyEscaping = true;
      continue;
    }

    if (isCurrentQuoteUnmatched && input[currentQuoteIndex[0]] === '"') {
      if (isSlash) {
        const escapableCharWithinDoubles = new Set(['"', "\\", "$", "`", "\n"]);
        if (escapableCharWithinDoubles.has(input[i + 1])) {
          currentlyEscaping = true;
          continue;
        }
      }
    }

    if (isSpace) {
      if (!isCurrentQuoteUnmatched) {
        if (currentWord) {
          words.push(currentWord);
        }
        currentWord = "";
      } else {
        currentWord += " ";
      }
      continue;
    }

    if (isQuote) {
      if (!isCurrentQuoteUnmatched) {
        quoteIndices.push([]);
      } else if (currentChar != input[currentQuoteIndex[0]]) {
        currentWord += currentChar;
        continue;
      }
      quoteIndices[quoteIndices.length - 1].push(i);
    } else {
      currentWord += currentChar;
    }
  }

  if (currentWord) {
    words.push(currentWord);
  }

  return {
    name: words[0] ?? "",
    args: words.slice(1),
    redirections: [],
  };
}
