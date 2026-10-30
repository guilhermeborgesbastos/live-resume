// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // replace the data below with your personal data
  personal: {
    caricature: "gbastos-illustration@2x.png",
    name: "Guilherme Borges Bastos",
    // how the assistant's AI answers refer to you (functions/src/core/prompt.ts)
    firstName: "Guilherme",
    birth: "1993-06-19",
    email: "guilhermeborgesbastos@gmail.com",
    location: "Gouda, South Holland, Netherlands",
    // the header logo, the CV file behind the download button (under src/), the site's address and
    // the line shared with the page (share button and meta description)
    brand: "gbastos",
    cvFile: "assets/cv-english-guilherme-bastos-v2.0.pdf",
    siteUrl: "https://guilhermeborgesbastos.com",
    pitch: "Hello, I'm a Full-stack Web Developer with 10+ years of experience designing web and mobile projects. Find out more in my live-resume!"
  },
  // Your Firebase web app's config (Firebase console → Project settings → Your apps). Left empty,
  // the site runs without Firebase: no analytics, the contact form reports that it can't send,
  // and the assistant answers only in the browser.
  firebaseConfig: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
  },
  // reCAPTCHA Enterprise (Google Cloud Fraud Defense) score-based key used by Firebase App Check to
  // protect the contact form and the assistant's AI answers (see DEPLOYMENT.md).
  // Leave it empty to send messages without App Check (AI answers then stay off).
  recaptchaSiteKey: "",
  // AI answers for questions the local CV assistant can't answer, through the askAssistant Cloud
  // Function (see DEPLOYMENT.md, "AI answers (Firebase)"). Off until the function is deployed and evaluated.
  assistantHosted: {
    enabled: false,
    functionsRegion: "europe-west4"
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
