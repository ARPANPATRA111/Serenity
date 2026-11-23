import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('clearPrivateSessionState', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('window', { sessionStorage: new MemoryStorage(), localStorage: new MemoryStorage() });
  });
  afterEach(() => vi.unstubAllGlobals());

  test('clears recipient data, editor details, cached responses, and the draft', async () => {
    const { useDataSourceStore } = await import('../src/store/dataSourceStore');
    const { useEditorStore } = await import('../src/store/editorStore');
    const { useGenerationStore } = await import('../src/store/generationStore');
    const coordinator = await import('../src/lib/api/requestCoordinator');
    const { clearPrivateSessionState, CANVAS_AUTOSAVE_KEY } = await import('../src/lib/session/privateSessionState');

    useDataSourceStore.getState().setDataSource({
      headers: ['Name', 'Email'],
      rows: [{ Name: 'Marker Recipient', Email: 'marker@example.test' }],
      fileName: 'roster.csv',
    } as never);
    useEditorStore.getState().setTemplateInfo('template-a', 'Account A design');
    useEditorStore.getState().setCertificateMetadata({ title: 'A title', issuedBy: 'A issuer', description: '' });
    useEditorStore.getState().setMediaAssets([{ id: 'asset-a' } as never]);
    useGenerationStore.getState().addGeneratedId('cert-a');
    coordinator.writeSessionJson('dashboard-summary:uid-a', { marker: true });
    window.sessionStorage.setItem('unrelated', 'kept');
    window.localStorage.setItem(CANVAS_AUTOSAVE_KEY, '{"canvasJSON":"{}"}');
    window.localStorage.setItem('serenity-recent-colors', 'kept');
    let calls = 0;
    const request = async () => { calls += 1; return new Response('{"owner":"a"}'); };
    await coordinator.coordinatedJson('dashboard-summary:uid-a', request, 60_000);

    clearPrivateSessionState();

    expect(useDataSourceStore.getState()).toMatchObject({ dataSource: null, rows: [], headers: [] });
    expect(useEditorStore.getState()).toMatchObject({ templateId: null, templateName: 'Untitled Template', mediaAssets: [] });
    expect(useEditorStore.getState().certificateMetadata.title).toBe('');
    expect(useGenerationStore.getState().generatedIds).toEqual([]);
    expect(coordinator.readSessionJson('dashboard-summary:uid-a', 60_000)).toBeNull();
    expect(window.sessionStorage.getItem('unrelated')).toBe('kept');
    expect(window.localStorage.getItem(CANVAS_AUTOSAVE_KEY)).toBeNull();
    expect(window.localStorage.getItem('serenity-recent-colors')).toBe('kept');

    await coordinator.coordinatedJson('dashboard-summary:uid-a', request, 60_000);
    expect(calls).toBe(2);
  });

  test('asks a running generation to stop instead of wiping its progress', async () => {
    const { useGenerationStore } = await import('../src/store/generationStore');
    const { clearPrivateSessionState } = await import('../src/lib/session/privateSessionState');

    useGenerationStore.getState().startGeneration(10);
    clearPrivateSessionState();

    expect(useGenerationStore.getState()).toMatchObject({ isGenerating: true, isCancelled: true });
  });
});
