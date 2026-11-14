import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// The suite runs many jsdom pages in parallel, so a busy machine can take longer than the default
// one second to settle a dialog or a data load. A longer wait only matters when something is slow;
// a test that passes still finishes as soon as the thing it waits for appears.
configure({ asyncUtilTimeout: 5000 });

// Tests that opt into the node environment (edge function logic) have no window.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  // Radix controls (radio group, checkbox) measure themselves with ResizeObserver, which jsdom does not have.
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: ResizeObserverStub });
  }
}
