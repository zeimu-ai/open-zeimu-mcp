export class TsutatsuRobotsPolicy {
  private readonly disallowRules: string[];

  constructor(robotsText: string) {
    this.disallowRules = parseDisallowRules(robotsText);
  }

  isAllowed(pathname: string) {
    return !this.disallowRules.some((rule) => pathname.startsWith(rule));
  }
}

function parseDisallowRules(robotsText: string) {
  const lines = robotsText.split(/\r?\n/u);
  const rules: string[] = [];
  let appliesToAllAgents = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const [rawKey, ...rawValue] = trimmed.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rawValue.join(":").trim();

    if (key === "user-agent") {
      appliesToAllAgents = value === "*";
      continue;
    }

    if (appliesToAllAgents && key === "disallow" && value) {
      rules.push(value);
    }
  }

  return rules;
}
