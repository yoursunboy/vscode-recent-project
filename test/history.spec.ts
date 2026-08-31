import { strict as assert } from 'node:assert';
import {
  normalizePath,
  basename,
  isProjectPath,
  parseHistory,
  extractProjectPaths,
} from '../src/history';

describe('normalizePath', () => {
  it('normalizes backslashes and trailing slashes', () => {
    assert.equal(normalizePath('C:\\Users\\me\\proj\\'), 'c:/Users/me/proj');
    assert.equal(normalizePath('C:/Users/me/proj/'), 'c:/Users/me/proj');
  });
  it('lowercases drive letter but keeps rest of case', () => {
    assert.equal(normalizePath('D:\\AI\\MyProject'), 'd:/AI/MyProject');
  });
  it('leaves posix-style relative-ish paths', () => {
    assert.equal(normalizePath('/home/user/proj'), '/home/user/proj');
  });
});

describe('basename', () => {
  it('takes last path segment on either separator', () => {
    assert.equal(basename('C:\\Users\\me\\proj'), 'proj');
    assert.equal(basename('/home/user/proj/'), 'proj');
  });
});

describe('isProjectPath', () => {
  it('accepts folders and workspaces', () => {
    assert.equal(isProjectPath('/a/b'), true);
    assert.equal(isProjectPath('C:\\a\\b\\c.code-workspace'), true);
  });
  it('rejects plain files', () => {
    assert.equal(isProjectPath('/a/file.txt'), false);
    assert.equal(isProjectPath('C:\\a\\file.ts'), false);
  });
  it('rejects remote/non-local workspaces', () => {
    assert.equal(isProjectPath('vscode-remote://ssh-remote+host/a/b'), false);
  });
});

describe('extractProjectPaths / parseHistory', () => {
  it('parses new format with entries', () => {
    const raw = {
      entries: [
        { folderUri: { path: '/a' } },
        { workspace: { path: '/b/c.code-workspace' } },
        { fileUri: { path: '/d/file.ts' } },
      ],
    };
    const paths = extractProjectPaths(raw);
    assert.deepEqual(paths, ['/a', '/b/c.code-workspace', '/d/file.ts']);
  });

  it('parses old flat array of {path}', () => {
    const raw = [{ path: '/x' }, { path: '/y' }];
    assert.deepEqual(extractProjectPaths(raw), ['/x', '/y']);
  });

  it('parses folderUri as file:// string (Cursor format)', () => {
    const raw = {
      entries: [
        { folderUri: 'file:///d%3A/Projects/travel' },
        { folderUri: 'file:///d%3A/Projects/PMS' },
      ],
    };
    assert.deepEqual(parseHistory(raw), ['d:/Projects/travel', 'd:/Projects/PMS']);
  });

  it('parseHistory filters files and dedups', () => {
    const raw = {
      entries: [
        { folderUri: { path: '/a' } },
        { folderUri: { path: '/a' } },
        { fileUri: { path: '/file.ts' } },
      ],
    };
    const result = parseHistory(raw);
    assert.deepEqual(result, ['/a']);
  });
});
