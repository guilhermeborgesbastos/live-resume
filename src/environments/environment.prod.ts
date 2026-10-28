export const environment = {
  production: true,
  // replace the data below with your personal data
  personal: {
    caricature: "gbastos-illustration@2x.png",
    name: "Guilherme Borges Bastos",
    // how the assistant's AI answers refer to you (functions/src/core/prompt.ts)
    firstName: "Guilherme",
    birth: "1993-06-19",
    email: "guilhermeborgesbastos@gmail.com",
    location: "Gouda, South Holland, Netherlands"
  },
  // replace the dummy data below with the real firebase configs
  firebaseConfig: {
    apiKey: "AIzaSyC2frVRAAltsVTmdwgFnATGHoVUzNHfzsM",
    authDomain: "live-resume-a575a.firebaseapp.com",
    databaseURL: "https://live-resume-a575a.firebaseio.com",
    projectId: "live-resume-a575a",
    storageBucket: "live-resume-a575a.appspot.com",
    messagingSenderId: "681076751855",
    appId: "1:681076751855:web:18bae3866ebfcc4fcd8a1a",
    measurementId: "G-00VXD77WNG"
  },
  // reCAPTCHA Enterprise (Google Cloud Fraud Defense) score-based key used by Firebase App Check to
  // protect the contact form and the assistant's AI answers (see DEPLOYMENT.md).
  // Leave it empty to send messages without App Check (AI answers then stay off).
  recaptchaSiteKey: "6Le1N_0tAAAAACfacFRB183pWUFi2kjjYM9pA2hY",
  // AI answers for questions the local CV assistant can't answer, through the askAssistant Cloud
  // Function (see DEPLOYMENT.md, "AI answers (Firebase)"). Off until the function is deployed and evaluated.
  assistantHosted: {
    enabled: false,
    functionsRegion: "europe-west4"
  }
};
