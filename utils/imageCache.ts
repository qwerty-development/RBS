// utils/imageCache.ts
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";

class ImageCache {
  private cacheDir = `${FileSystem.cacheDirectory}images/`;
  private maxCacheSize = 100 * 1024 * 1024; // 100MB
  private cacheIndex: Map<
    string,
    { path: string; size: number; lastAccessed: number }
  > = new Map();

  async getCachedImage(uri: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uri,
    );
    const cachedPath = `${this.cacheDir}${hash}`;

    const info = await FileSystem.getInfoAsync(cachedPath);
    if (info.exists) {
      this.updateAccessTime(hash);
      return cachedPath;
    }

    return this.downloadAndCache(uri, hash);
  }

  private async downloadAndCache(uri: string, hash: string): Promise<string> {
    const path = `${this.cacheDir}${hash}`;

    await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
    await FileSystem.downloadAsync(uri, path);

    const info = await FileSystem.getInfoAsync(path);
    this.cacheIndex.set(hash, {
      path,
      size: info.size || 0,
      lastAccessed: Date.now(),
    });

    await this.cleanupIfNeeded();

    return path;
  }

  private async cleanupIfNeeded() {
    const totalSize = Array.from(this.cacheIndex.values()).reduce(
      (sum, item) => sum + item.size,
      0,
    );

    if (totalSize > this.maxCacheSize) {
      const sortedEntries = Array.from(this.cacheIndex.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed,
      );

      let currentSize = totalSize;
      for (const [hash, info] of sortedEntries) {
        if (currentSize <= this.maxCacheSize * 0.8) break;

        await FileSystem.deleteAsync(info.path, { idempotent: true });
        this.cacheIndex.delete(hash);
        currentSize -= info.size;
      }
    }
  }

  private updateAccessTime(hash: string) {
    const entry = this.cacheIndex.get(hash);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }
}

export const imageCache = new ImageCache();
