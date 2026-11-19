// What the chat takes from the page it's on: its language (<html lang>), and the page's own button label
// and suggested questions, if it gives them:
//   <meta name="turquoise:label" content="Ask about Berk">
//   <meta name="turquoise:suggestions" content="First question|Second question">

const WORDS = {
  en: {
    label: "Ask Turquoise",
    close: "Close the chat",
    dialog: "Turquoise, the assistant on this site",
    greeting: "Hi! I'm Turquoise, the assistant on this site. Ask me about this page, the lessons and posts here, or Berk.",
    suggestions: ["Summarize this page", "Explain this page's topic simply", "How do you work?"],
    placeholder: "Ask a question…",
    question: "Your question",
    send: "Send",
    newChat: "New conversation",
    thinking: "Thinking…",
    thought: (s?: number) => (s ? `Thought for ${s}s` : "Thought"),
    waiting: "Waiting for the result…",
    found: (n: number) => (n === 0 ? "nothing found" : `${n} found`),
    failed: "failed",
    status: { checking: "Connecting…", gpu: "Running on Berk's GPU", quick: "Quick answers: Berk's GPU is off", offline: "Offline right now" },
    unreachable: "The assistant isn't reachable right now. Try again in a moment.",
    tools: {
      read_page: ["Reading this page", "Read this page"],
      search_site: ["Searching berkmonder.com", "Searched berkmonder.com"],
      search_profile: ["Searching Berk's CV", "Searched Berk's CV"],
      get_status: ["Checking live status", "Checked live status"],
    } as Record<string, [string, string]>,
    using: (name: string) => [`Using ${name}`, `Used ${name}`] as [string, string],
    gpu: "Berk's GPU",
    sites: "Sites",
    page: "page",
  },
  tr: {
    label: "Turquoise'a sor",
    close: "Sohbeti kapat",
    dialog: "Turquoise, bu sitenin asistanı",
    greeting: "Merhaba! Ben Turquoise, bu sitenin asistanıyım. Bu sayfa, buradaki dersler ve yazılar ya da Berk hakkında sorabilirsiniz.",
    suggestions: ["Bu sayfayı özetle", "Bu sayfanın konusunu basitçe anlat", "Nasıl çalışıyorsun?"],
    placeholder: "Bir şey sorun…",
    question: "Sorunuz",
    send: "Gönder",
    newChat: "Yeni sohbet",
    thinking: "Düşünüyor…",
    thought: (s?: number) => (s ? `${s} saniye düşündü` : "Düşündü"),
    waiting: "Sonuç bekleniyor…",
    found: (n: number) => (n === 0 ? "bir şey bulunamadı" : `${n} sonuç`),
    failed: "başarısız",
    status: { checking: "Bağlanıyor…", gpu: "Berk'in GPU'sunda çalışıyor", quick: "Hızlı cevaplar: Berk'in GPU'su kapalı", offline: "Şu an çevrimdışı" },
    unreachable: "Asistana şu an ulaşılamıyor. Birazdan tekrar deneyin.",
    tools: {
      read_page: ["Bu sayfayı okuyor", "Bu sayfayı okudu"],
      search_site: ["berkmonder.com'da arıyor", "berkmonder.com'da aradı"],
      search_profile: ["Berk'in özgeçmişinde arıyor", "Berk'in özgeçmişinde aradı"],
      get_status: ["Anlık durumu kontrol ediyor", "Anlık durumu kontrol etti"],
    } as Record<string, [string, string]>,
    using: (name: string) => [`${name} kullanıyor`, `${name} kullandı`] as [string, string],
    gpu: "Berk'in GPU'su",
    sites: "Siteler",
    page: "sayfa",
  },
};

export type Words = (typeof WORDS)["en"];

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;

/** The chat's words in the page's language, with the page's own label and suggestions. */
export function pageWords(): Words {
  const words = document.documentElement.lang.startsWith("tr") ? WORDS.tr : WORDS.en;
  const suggestions = meta("turquoise:suggestions")?.split("|").filter(Boolean);
  return { ...words, label: meta("turquoise:label") || words.label, suggestions: suggestions?.length ? suggestions : words.suggestions };
}

/** The page's path, sent with every question so the assistant knows what "this page" is. */
export const pagePath = () => location.pathname;
