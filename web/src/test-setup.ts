// jsdom is not a browser, and it implements none of these. Radix calls them
// while a Select opens, so without the stubs the dropdown throws instead of
// rendering its options and every test that picks one fails for a reason that
// has nothing to do with the component.
for (const method of [
  'hasPointerCapture',
  'setPointerCapture',
  'releasePointerCapture',
  'scrollIntoView',
] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, {
      value: () => false,
      writable: true,
    });
  }
}
