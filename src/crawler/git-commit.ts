import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const execFile = promisify(execFileCallback);

type CommitChangesOptions = {
  repoDir: string;
  paths: string[];
  message: string;
  dryRun: boolean;
};

export async function commitAndPushChanges({
  repoDir,
  paths,
  message,
  dryRun,
}: CommitChangesOptions) {
  if (paths.length === 0) {
    return { committed: false, pushed: false };
  }

  if (dryRun) {
    return { committed: false, pushed: false };
  }

  await execGit(repoDir, ["add", "--", ...paths]);

  const { stdout: staged } = await execGit(repoDir, ["diff", "--cached", "--name-only"]);

  if (!staged.trim()) {
    return { committed: false, pushed: false };
  }

  await execGit(repoDir, [
    "-c",
    "user.name=zeimu-data-bot",
    "-c",
    "user.email=bot@zeimu.ai",
    "commit",
    "-m",
    message,
  ]);
  await execGit(repoDir, ["push", "origin", "main"]);

  return { committed: true, pushed: true };
}

async function execGit(repoDir: string, args: string[]) {
  return execFile("git", args, { cwd: repoDir });
}
