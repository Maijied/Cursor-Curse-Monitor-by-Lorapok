import { describe, expect, it } from 'vitest';
import { normalizeSiteData, resolvePackageVersion } from './site-data';

describe('resolvePackageVersion', () => {
  it('uses packageVersion when it is a real release', () => {
    expect(resolvePackageVersion({ packageVersion: '1.0.64', version: '1.0.64' })).toBe('1.0.64');
  });

  it('falls back to version when packageVersion is the 0.0.0 placeholder', () => {
    expect(resolvePackageVersion({ packageVersion: '0.0.0', version: '1.0.64' })).toBe('1.0.64');
  });

  it('normalizes site data in place', () => {
    const normalized = normalizeSiteData({
      generatedAt: '2026-01-01T00:00:00.000Z',
      version: '1.0.64',
      packageVersion: '0.0.0',
      syncStatus: 'synced',
      ovsx: { version: null, url: '' },
      vscode: { version: null, url: '' },
      github: { releaseTag: 'v1.0.64', releaseUrl: '', publishedAt: null },
    });
    expect(normalized.packageVersion).toBe('1.0.64');
  });
});
