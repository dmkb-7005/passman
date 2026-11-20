import { z } from 'zod';

/**
 * Who built what and when. Written at build time by vite.config.ts: compiled into the bundle (this build) and
 * emitted as version.json (read from a pending build by the update dialog). See docs/ARCHITECTURE.md §5.2.
 */
export interface BuildInfo {
  version: string;
  /** full commit SHA, or "dev" for a local build without git */
  commit: string;
  commitMessage: string;
  commitAuthor: string;
  committedAt: string;
  /** when the bundle was built (the deploy job runs right after) */
  deployedAt: string;
  /** GitHub account that triggered the deploy, or "local build" */
  deployedBy: string;
  repoUrl: string;
  /** GitHub Actions run, empty for local builds */
  runUrl: string;
}

const MAX = 300;
const BuildInfoSchema = z.object({
  version: z.string().max(40),
  commit: z.string().max(64),
  commitMessage: z.string().max(MAX),
  commitAuthor: z.string().max(MAX),
  committedAt: z.string().max(40),
  deployedAt: z.string().max(40),
  deployedBy: z.string().max(MAX),
  repoUrl: z.string().max(MAX),
  runUrl: z.string().max(MAX),
});

/** Validates version.json of a pending build; null if it is missing or malformed. */
export function parseBuildInfo(raw: unknown): BuildInfo | null {
  const result = BuildInfoSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** This build. */
export const BUILD_INFO: BuildInfo = __BUILD_INFO__;

const GITHUB = 'https://github.com/';

/** Links shown in the dialog and in Settings: only to github.com, never to anything the file makes up. */
export function buildLinks(info: BuildInfo): { commitUrl: string | null; runUrl: string | null } {
  const repoOk = info.repoUrl.startsWith(GITHUB) && !info.repoUrl.includes('?');
  const commitOk = /^[0-9a-f]{7,40}$/.test(info.commit);
  return {
    commitUrl: repoOk && commitOk ? `${info.repoUrl}/commit/${info.commit}` : null,
    runUrl: info.runUrl.startsWith(GITHUB) ? info.runUrl : null,
  };
}

export function shortCommit(commit: string): string {
  return /^[0-9a-f]{7,40}$/.test(commit) ? commit.slice(0, 7) : commit;
}
