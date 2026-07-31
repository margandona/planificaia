// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyADeo8Y7lVBeT4MJNXOqQSbirOa6sdX3EY",
  authDomain: "planificacion-con-ia.firebaseapp.com",
  projectId: "planificacion-con-ia",
  storageBucket: "planificacion-con-ia.firebasestorage.app",
  messagingSenderId: "317744047775",
  appId: "1:317744047775:web:c7779e496403a6e64ae4aa",
  measurementId: "G-TFHV3R6JT0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);