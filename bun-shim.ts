import { mock } from "bun:test";

// Polyfill jest global for Bun
globalThis.jest = {
  fn: (impl?: any) => mock(impl),
  mock: (moduleName: string, factory: any) => {
    mock.module(moduleName, factory);
  },
  clearAllMocks: () => {
    // Bun's mock.clearAllMocks() might work or we can just let it be
  },
} as any;
