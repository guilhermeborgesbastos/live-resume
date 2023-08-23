// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // replace the data below with your personal data
  personal: {
    caricature: "gbastos-illustration@2x.png",
    name: "Aswin Stevin",
    birth: "1999-06-18",
    email: "aswinstevin@gmail.com",
    phone: "+971552989059",
    location: "Muwaileh, Sharjah, United Arab Emirates"
  },
  // replace the dummy data below with the real firebase configs
  firebaseConfig: {
    apiKey: "AIzaSyCsIlrKBdGLqrJOS6Ir1WRRF8QpCtmvOKQ",
  authDomain: "aswins-live-re.firebaseapp.com",
  projectId: "aswins-live-re",
  storageBucket: "aswins-live-re.appspot.com",
  messagingSenderId: "471643663300",
  appId: "1:471643663300:web:7117873b42a0242cc1d291"
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
