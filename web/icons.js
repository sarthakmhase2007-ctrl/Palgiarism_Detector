const paths = {
  upload:
    '<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  flask:
    '<path d="M9 3h6m-5 0v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3M7.8 14h8.4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3m-8 0H5a2 2 0 0 1-2-2v-3m5-6h8m-8 4h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  link: '<path d="m10 13 4-4m-4 7-1.6 1.6a3.7 3.7 0 0 1-5.2-5.2L7 8.6a3.7 3.7 0 0 1 5.2 0m-.4 6.8a3.7 3.7 0 0 0 5.2 0l3.8-3.8a3.7 3.7 0 0 0-5.2-5.2L14 8"/>',
  bars: '<path d="M4 20h16M6 16v-5m6 5V4m6 12V8"/>',
  quote:
    '<path d="M4 7h6v6a4 4 0 0 1-4 4M4 7v6h6m4-6h6v6a4 4 0 0 1-4 4m-2-10v6h6"/>',
  network:
    '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.8 7.2-4.6 8.4m7-8.4 4.6 8.4M7.5 18h9"/>',
  github:
    '<path fill="currentColor" stroke="none" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.73 2.63 1.23 3.27.94.1-.73.39-1.23.71-1.51-2.5-.29-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.16-3.01-.12-.29-.5-1.43.11-2.98 0 0 .95-.31 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.13-1.46 3.08-1.15 3.08-1.15.61 1.55.23 2.69.11 2.98.72.78 1.16 1.78 1.16 3.01 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.04.76 2.1v3.09c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"/>',
};

export function addIcons(root) {
  for (const icon of root.querySelectorAll("i[data-icon]")) {
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
      paths[icon.dataset.icon] +
      "</svg>";
  }
}
