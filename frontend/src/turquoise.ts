// What a page loads (<script type="module" src="/widget/turquoise.js">). It adds the chat: full-size in
// any <div data-turquoise-inline>, otherwise as a button in the bottom-right corner. The rest (React,
// the chat) loads in the background, as its own cached files.

async function start() {
  const { mount } = await import("./mount");
  mount();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
