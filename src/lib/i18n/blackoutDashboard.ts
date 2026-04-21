export type BlackoutLang = "en" | "es";

const STRINGS: Record<BlackoutLang, Record<string, string>> = {
  en: {
    title: "Swarm command centre",
    subtitle:
      "Vertex 2.0 mesh, FoxMQ world map, and deterministic replay — scenario-first layout with a single flat envelope across panels.",
    run: "Run",
    pause: "Pause",
    live: "Live",
    demo: "Demo",
    themeLight: "Light",
    themeDark: "Dark",
    notify: "Alerts",
    tour: "Tour",
    shortcuts: "Ctrl+Shift+K kill scout · Ctrl+Shift+S settlement · Ctrl+Shift+R reset mesh stress",
  },
  es: {
    title: "Centro de mando del enjambre",
    subtitle:
      "Malla Vertex 2.0, mapa FoxMQ y reproducción determinista — diseño por escenario con un único sobre de estado compartido.",
    run: "Ejecutar",
    pause: "Pausa",
    live: "En vivo",
    demo: "Demo",
    themeLight: "Claro",
    themeDark: "Oscuro",
    notify: "Alertas",
    tour: "Tour",
    shortcuts: "Ctrl+Shift+K scout · Ctrl+Shift+S liquidación · Ctrl+Shift+R reset estrés",
  },
};

export function t(key: string, lang: BlackoutLang): string {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
}
