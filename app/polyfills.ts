// polyfills.ts
if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = function structuredClone(value: any): any {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (Array.isArray(value)) {
      return value.map((item) => structuredClone(item));
    }

    if (typeof value === "object") {
      const cloned: any = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          cloned[key] = structuredClone(value[key]);
        }
      }
      return cloned;
    }

    return value;
  };
}
