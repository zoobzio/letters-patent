import { defineNuxtConfig } from "nuxt/config";

/**
 * The Acme app. The contract is the preset: the kit build of the patents
 * example, taken from the installed package. Authentication is stubbed —
 * the server picks a demo account and holds it in a cookie — so the app
 * runs with no Google client.
 */
export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  modules: ["@letters-patent/nuxt"],
  lettersPatent: { preset: "@letters-patent/example-patents" },
  css: ["~/assets/main.css"],
});
