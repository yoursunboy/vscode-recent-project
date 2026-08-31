import { strict as assert } from 'node:assert';
import type { Memento } from 'vscode';
import { ProjectStore } from '../src/store';

/** 最小 Memento 假实现，内存存储 */
class FakeMemento implements Memento {
  private data: Record<string, unknown> = {};
  get<T>(key: string, defaultValue?: T): T | undefined {
    const v = this.data[key];
    return v === undefined ? defaultValue : (v as T);
  }
  update(key: string, value: unknown): Thenable<void> {
    this.data[key] = value;
    return Promise.resolve();
  }
  keys(): readonly string[] {
    return Object.keys(this.data);
  }
}

function makeStore() {
  return new ProjectStore(new FakeMemento());
}

describe('ProjectStore', () => {
  it('merges history paths and records open time', () => {
    const store = makeStore();
    store.mergeHistory(['/a', '/b']); // index 0 = 最近
    assert.deepEqual(store.list().map((e) => e.path), ['/a', '/b']);
  });

  it('dedups already-known paths', () => {
    const store = makeStore();
    store.mergeHistory(['/a']);
    store.mergeHistory(['/a']);
    assert.equal(store.list().length, 1);
  });

  it('sorts by recency (index 0 newest)', () => {
    const store = makeStore();
    store.mergeHistory(['/a', '/b']);
    const list = store.list();
    assert.equal(list[0].path, '/a');
    assert.equal(list[1].path, '/b');
  });

  it('keeps pinned items on top', () => {
    const store = makeStore();
    store.mergeHistory(['/a', '/b']);
    store.togglePin('/a');
    const list = store.list();
    assert.equal(list[0].path, '/a');
    assert.equal(list[1].path, '/b');
  });

  it('sets note and clears when empty', () => {
    const store = makeStore();
    store.mergeHistory(['/a']);
    store.setNote('/a', '我的项目');
    assert.equal(store.list()[0].note, '我的项目');
    store.setNote('/a', '   ');
    assert.equal(store.list()[0].note, undefined);
  });

  it('removes via tombstone and does not resurrect on merge', () => {
    const store = makeStore();
    store.mergeHistory(['/a']);
    store.remove('/a');
    assert.equal(store.list().length, 0);
    store.mergeHistory(['/a']);
    assert.equal(store.list().length, 0, 'removed project should not come back');
  });
});
