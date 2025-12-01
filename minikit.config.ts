const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    "header": "eyJmaWQiOjEzNDU3NDgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2YWQ4RTRjNzVjOTdmM0RkREZmNWI3NTRiMzI0QWExMWI1MzUxQjE5In0",
    "payload": "eyJkb21haW4iOiJndWVzczQtZ2FtZS52ZXJjZWwuYXBwIn0",
    "signature": "O34kI2JOdM6KG1VqpejMyBuUAny3MVBkNqj65KCo9yNPcwPDGa0eNl33MeAyiNwAX+JmHtsXJPV0BwjrktOzhhs="
  },
  miniapp: {
    version: "1",
    name: "Guess4",
    subtitle: "Crack the 4-digit code",
    description: "Guess the number.",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["game", "puzzle", "logic"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`,
    tagline: "Guess it quick",
    ogTitle: "Guess4",
    ogDescription: "A quick, addictive code-breaker.",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
} as const;

