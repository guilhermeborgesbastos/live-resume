// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // replace the data below with your personal data
  personal: {
    caricature: "caricature.png",
    name: "Soslan Tmenov",
    birth: "1989-03-23",
    email: "tmenatisoslan@gmail.com",
    phone: "+1 xxx xxx xx xx",
    location: "Sevierville, TN"
  },
  // replace the dummy data below with the real firebase configs
  firebaseConfig: {
    apiKey: "AIzaSyAsyh5bMztJ4Jl8w27VtpNeISBxK6G0C20",
    authDomain: "live-resume-54ff3.firebaseapp.com",
    databaseURL: "https://live-resume-54ff3-default-rtdb.firebaseio.com/",
    projectId: "live-resume-54ff3",
    storageBucket: "live-resume-54ff3.appspot.com",
    messagingSenderId: "1025552431094",
    appId: "1:1025552431094:web:afaba7bedffec312a2b9d7"
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
