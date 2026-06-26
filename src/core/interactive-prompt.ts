import * as readline from "readline";

/**
 * 交互式确认选项
 */
export interface ConfirmOptions {
  question: string;
  default?: boolean;
  details?: string[];
}

/**
 * 交互式选择选项
 */
export interface ChoiceOptions {
  question: string;
  choices: string[];
  defaultIndex?: number;
}

/**
 * 创建 readline 接口
 */
function createRl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 交互式确认（是/否）
 *
 * 注意：非交互式环境（如 CI/CD）下默认返回 default 值
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  // 非交互式环境直接返回默认值
  if (!process.stdin.isTTY) {
    return options.default ?? false;
  }

  const rl = createRl();

  try {
    const { question, default: defaultValue, details } = options;

    // 显示详细信息
    if (details && details.length > 0) {
      for (const line of details) {
        console.log(line);
      }
      console.log("");
    }

    const suffix = defaultValue === true ? " [Y/n] " : " [y/N] ";
    const fullQuestion = question + suffix;

    const answer = await new Promise<string>(resolve => {
      rl.question(fullQuestion, resolve);
    });

    const trimmed = answer.trim().toLowerCase();

    if (trimmed === "") {
      return defaultValue ?? false;
    }

    return trimmed === "y" || trimmed === "yes";
  } finally {
    rl.close();
  }
}

/**
 * 交互式输入文本
 */
export async function input(question: string, defaultValue?: string): Promise<string> {
  // 非交互式环境直接返回默认值
  if (!process.stdin.isTTY) {
    return defaultValue ?? "";
  }

  const rl = createRl();

  try {
    const suffix = defaultValue ? ` [${defaultValue}] ` : " ";
    const fullQuestion = question + suffix;

    const answer = await new Promise<string>(resolve => {
      rl.question(fullQuestion, resolve);
    });

    const trimmed = answer.trim();
    return trimmed || defaultValue || "";
  } finally {
    rl.close();
  }
}

/**
 * 检查当前是否为交互式终端
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}
