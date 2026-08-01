import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMusicStore } from '@/stores/useMusicStore';

// Mock @phlix/ui components
vi.mock('@phlix/ui', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    get: vi.fn()
  })),
  useApiBase: vi.fn(() => ({ value: 'https://api.example.com' }))
}));

vi.mock('@phlix/contracts', () => ({}));

describe('useMusicStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('has empty artists array', () => {
      const store = useMusicStore();
      expect(store.artists).toEqual([]);
    });

    it('has empty albums array', () => {
      const store = useMusicStore();
      expect(store.albums).toEqual([]);
    });

    it('has null currentAlbum', () => {
      const store = useMusicStore();
      expect(store.currentAlbum).toBeNull();
    });

    it('has null currentTrack', () => {
      const store = useMusicStore();
      expect(store.currentTrack).toBeNull();
    });

    it('has default loading state as false', () => {
      const store = useMusicStore();
      expect(store.loading).toBe(false);
    });

    it('has null error', () => {
      const store = useMusicStore();
      expect(store.error).toBeNull();
    });

    it('has default view as artists', () => {
      const store = useMusicStore();
      expect(store.currentView).toBe('artists');
    });

    it('has null selectedArtistId', () => {
      const store = useMusicStore();
      expect(store.selectedArtistId).toBeNull();
    });

    it('has null selectedAlbumId', () => {
      const store = useMusicStore();
      expect(store.selectedAlbumId).toBeNull();
    });
  });

  describe('setView', () => {
    it('changes currentView to specified view', () => {
      const store = useMusicStore();
      store.setView('albums');
      expect(store.currentView).toBe('albums');
      store.setView('tracks');
      expect(store.currentView).toBe('tracks');
      store.setView('artists');
      expect(store.currentView).toBe('artists');
    });
  });

  describe('selectArtist', () => {
    it('sets selectedArtistId', () => {
      const store = useMusicStore();
      store.selectArtist(123);
      expect(store.selectedArtistId).toBe(123);
    });

    it('resets selectedAlbumId and currentAlbum', () => {
      const store = useMusicStore();
      store.selectArtist(123);
      expect(store.selectedAlbumId).toBeNull();
      expect(store.currentAlbum).toBeNull();
    });

    it('changes view to albums', () => {
      const store = useMusicStore();
      store.selectArtist(123);
      expect(store.currentView).toBe('albums');
    });
  });

  describe('selectAlbum', () => {
    it('sets selectedAlbumId', () => {
      const store = useMusicStore();
      store.selectAlbum(456);
      expect(store.selectedAlbumId).toBe(456);
    });

    it('changes view to tracks', () => {
      const store = useMusicStore();
      store.selectAlbum(456);
      expect(store.currentView).toBe('tracks');
    });
  });

  describe('goBack', () => {
    it('from tracks view goes back to albums view', () => {
      const store = useMusicStore();
      store.selectArtist(123);
      store.selectAlbum(456);
      store.currentView = 'tracks';
      store.goBack();
      expect(store.currentView).toBe('albums');
    });

    it('from tracks view clears album selection', () => {
      const store = useMusicStore();
      store.selectArtist(123);
      store.selectAlbum(456);
      store.currentView = 'tracks';
      store.goBack();
      expect(store.selectedAlbumId).toBeNull();
      expect(store.currentAlbum).toBeNull();
    });

    it('from albums view goes back to artists view', () => {
      const store = useMusicStore();
      store.selectArtist(123);
      store.currentView = 'albums';
      store.goBack();
      expect(store.currentView).toBe('artists');
    });

    it('from albums view clears artist selection', () => {
      const store = useMusicStore();
      store.selectArtist(123);
      store.currentView = 'albums';
      store.goBack();
      expect(store.selectedArtistId).toBeNull();
    });

    it('from artists view stays on artists view', () => {
      const store = useMusicStore();
      store.currentView = 'artists';
      store.goBack();
      expect(store.currentView).toBe('artists');
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      const store = useMusicStore();
      // @ts-expect-error - setting error directly for test
      store.error = 'Some error';
      store.clearError();
      expect(store.error).toBeNull();
    });
  });

  describe('computed properties', () => {
    describe('artistAlbums', () => {
      it('returns empty array when no artist is selected', () => {
        const store = useMusicStore();
        expect(store.artistAlbums).toEqual([]);
      });

      it('filters albums by selected artist', () => {
        const store = useMusicStore();
        // @ts-expect-error - setting albums directly for test
        store.albums = [
          { id: 1, artistId: 100, title: 'Album A' },
          { id: 2, artistId: 200, title: 'Album B' },
          { id: 3, artistId: 100, title: 'Album C' }
        ];
        store.selectArtist(100);
        expect(store.artistAlbums).toHaveLength(2);
        expect(store.artistAlbums.map((a: any) => a.id)).toEqual([1, 3]);
      });
    });

    describe('albumTracks', () => {
      it('returns empty array when no album is selected', () => {
        const store = useMusicStore();
        expect(store.albumTracks).toEqual([]);
      });

      it('returns album tracks when album is set', () => {
        const store = useMusicStore();
        const tracks = [{ id: 1, title: 'Track 1' }, { id: 2, title: 'Track 2' }];
        // @ts-expect-error - setting currentAlbum directly for test
        store.currentAlbum = { id: 1, title: 'Test Album', tracks };
        expect(store.albumTracks).toEqual(tracks);
      });
    });
  });

  describe('async actions', () => {
    it('fetchArtists handles API errors gracefully', async () => {
      const store = useMusicStore();
      const { ApiClient } = await import('@phlix/ui');
      const mockGet = vi.fn().mockRejectedValue(new Error('Network error'));
      (ApiClient as any).mockImplementation(() => ({
        get: mockGet
      }));

      await store.fetchArtists();
      expect(store.error).toBe('Network error');
      expect(store.artists).toEqual([]);
      expect(store.loading).toBe(false);
    });

    it('fetchAlbums handles API errors gracefully', async () => {
      const store = useMusicStore();
      const { ApiClient } = await import('@phlix/ui');
      const mockGet = vi.fn().mockRejectedValue(new Error('API failed'));
      (ApiClient as any).mockImplementation(() => ({
        get: mockGet
      }));

      await store.fetchAlbums();
      expect(store.error).toBe('API failed');
      expect(store.albums).toEqual([]);
      expect(store.loading).toBe(false);
    });

    it('fetchAlbum handles API errors gracefully', async () => {
      const store = useMusicStore();
      const { ApiClient } = await import('@phlix/ui');
      const mockGet = vi.fn().mockRejectedValue(new Error('Album not found'));
      (ApiClient as any).mockImplementation(() => ({
        get: mockGet
      }));

      await store.fetchAlbum(123);
      expect(store.error).toBe('Album not found');
      expect(store.currentAlbum).toBeNull();
      expect(store.loading).toBe(false);
    });

    it('fetchTrack handles API errors gracefully', async () => {
      const store = useMusicStore();
      const { ApiClient } = await import('@phlix/ui');
      const mockGet = vi.fn().mockRejectedValue(new Error('Track not found'));
      (ApiClient as any).mockImplementation(() => ({
        get: mockGet
      }));

      await store.fetchTrack(456);
      expect(store.error).toBe('Track not found');
      expect(store.currentTrack).toBeNull();
      expect(store.loading).toBe(false);
    });

    it('fetchArtists sets loading state correctly', async () => {
      const store = useMusicStore();
      const { ApiClient } = await import('@phlix/ui');
      let resolvePromise: (value: any) => void;
      const promise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });
      const mockGet = vi.fn().mockReturnValue(promise);
      (ApiClient as any).mockImplementation(() => ({
        get: mockGet
      }));

      const fetchPromise = store.fetchArtists();
      expect(store.loading).toBe(true);

      resolvePromise!({ artists: [] });
      await fetchPromise;
      expect(store.loading).toBe(false);
    });
  });
});
