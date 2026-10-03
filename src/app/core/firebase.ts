import { InjectionToken } from "@angular/core";
import { FirebaseApp, initializeApp } from "firebase/app";
import { environment } from "../../environments/environment";

/**
 * The application's Firebase app instance. Product SDKs (Firestore, Analytics) are loaded
 * on demand by the services that need them, so they stay out of the initial bundle.
 */
export const FIREBASE_APP = new InjectionToken<FirebaseApp>("FIREBASE_APP", {
  providedIn: "root",
  factory: () => initializeApp(environment.firebaseConfig)
});
