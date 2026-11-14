import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

export function readSecret(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    return readSecretFromPipe(prompt);
  }

  return new Promise((resolve, reject) => {
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    const cleanup = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
    };

    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Operación cancelada."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }

        if (character >= " ") {
          value += character;
          stdout.write("*");
        }
      }
    };

    stdin.on("data", onData);
  });
}

async function readSecretFromPipe(prompt: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    stdout.write(prompt);
    return await rl.question("");
  } finally {
    rl.close();
  }
}

export type ParsedArgs = {
  values: Record<string, string | boolean>;
  positionals: string[];
};

export function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument) {
      continue;
    }

    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }

    const key = argument.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }

  return { values, positionals };
}

export function stringValue(
  values: Record<string, string | boolean>,
  key: string,
): string | undefined {
  const value = values[key];
  return typeof value === "string" ? value : undefined;
}
