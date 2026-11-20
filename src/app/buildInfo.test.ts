import { buildLinks, parseBuildInfo, shortCommit, type BuildInfo } from './buildInfo';

const info: BuildInfo = {
  version: '0.2.0',
  commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  commitMessage: 'Add import',
  commitAuthor: 'dmkb',
  committedAt: '2026-11-20T10:00:00+01:00',
  deployedAt: '2026-11-20T09:05:00.000Z',
  deployedBy: 'dmkb-7005',
  repoUrl: 'https://github.com/dmkb-7005/passman',
  runUrl: 'https://github.com/dmkb-7005/passman/actions/runs/1',
};

describe('parseBuildInfo', () => {
  it('accepts a valid file and rejects junk', () => {
    expect(parseBuildInfo(info)).toEqual(info);
    expect(parseBuildInfo({ version: 1 })).toBeNull();
    expect(parseBuildInfo(null)).toBeNull();
  });
});

describe('buildLinks', () => {
  it('links to the commit and run on github.com', () => {
    expect(buildLinks(info)).toEqual({
      commitUrl: 'https://github.com/dmkb-7005/passman/commit/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      runUrl: info.runUrl,
    });
  });
  it('never links anywhere else', () => {
    expect(buildLinks({ ...info, repoUrl: 'https://evil.example/x', runUrl: 'https://evil.example/run' })).toEqual({ commitUrl: null, runUrl: null });
    expect(buildLinks({ ...info, commit: 'dev', runUrl: '' })).toEqual({ commitUrl: null, runUrl: null });
  });
});

it('shortCommit', () => {
  expect(shortCommit(info.commit)).toBe('a1b2c3d');
  expect(shortCommit('dev')).toBe('dev');
});
