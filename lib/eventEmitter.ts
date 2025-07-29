// lib/eventEmitter.ts
export class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach((callback) => callback(...args));
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}

// Global playlist event emitter
export const playlistEventEmitter = new EventEmitter();

// Playlist event constants
export const PLAYLIST_EVENTS = {
  UPDATED: 'playlist_updated',
  CREATED: 'playlist_created',
  DELETED: 'playlist_deleted',
  RESTAURANT_ADDED: 'playlist_restaurant_added',
  RESTAURANT_REMOVED: 'playlist_restaurant_removed',
} as const;
