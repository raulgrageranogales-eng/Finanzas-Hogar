import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================
   FIREBASE
   ========================================= */

const firebaseConfig = {
    apiKey: "AIzaSyA1oKOXWYqauiGL4N8Oh3mG3JMP5ZFCxGw",
    authDomain: "finanzas-hogar-803fd.firebaseapp.com",
    projectId: "finanzas-hogar-803fd",
    storageBucket: "finanzas-hogar-803fd.firebasestorage.app",
    messagingSenderId: "461089916272",
    appId: "1:461089916272:web:c0755eddab52ea08673bb5"
};


const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();


/* =========================================
   ELEMENTOS DE LA INTERFAZ
   ========================================= */

const loginScreen =
    document.getElementById("login-screen");

const appScreen =
    document.getElementById("app-screen");

const googleLogin =
    document.getElementById("google-login");

const logoutButton =
    document.getElementById("logout-button");

const loginError =
    document.getElementById("login-error");

const userName =
    document.getElementById("user-name");

const noHome =
    document.getElementById("no-home");

const homeContent =
    document.getElementById("home-content");

const privateContent =
    document.getElementById("private-content");

const createHome =
    document.getElementById("create-home");

const homeNameInput =
    document.getElementById("home-name");

const homeNameDisplay =
    document.getElementById("home-name-display");

const privateButton =
    document.getElementById("private-button");

const backHome =
    document.getElementById("back-home");


/* =========================================
   LOGIN CON GOOGLE
   ========================================= */

googleLogin.addEventListener("click", async () => {

    loginError.textContent = "";

    try {

        await signInWithPopup(
            auth,
            googleProvider
        );

    } catch (error) {

        console.error(
            "Error de inicio de sesión:",
            error
        );

        loginError.textContent =
            "No se ha podido iniciar sesión con Google.";

    }

});


/* =========================================
   CERRAR SESIÓN
   ========================================= */

logoutButton.addEventListener("click", async () => {

    try {

        await signOut(auth);

    } catch (error) {

        console.error(
            "Error cerrando sesión:",
            error
        );

    }

});


/* =========================================
   CONTROL DE AUTENTICACIÓN
   ========================================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        loginScreen.classList.remove("hidden");

        appScreen.classList.add("hidden");

        return;
    }


    loginScreen.classList.add("hidden");

    appScreen.classList.remove("hidden");


    userName.textContent =
        user.displayName || "Usuario";


    await loadUser(user);

});


/* =========================================
   CARGAR USUARIO
   ========================================= */

async function loadUser(user) {

    try {

        const userRef =
            doc(db, "users", user.uid);

        const userSnap =
            await getDoc(userRef);


        /*
         * PRIMER ACCESO
         */

        if (!userSnap.exists()) {

            await setDoc(
                userRef,
                {
                    uid: user.uid,

                    name:
                        user.displayName ||
                        "Usuario",

                    email:
                        user.email ||
                        "",

                    photoURL:
                        user.photoURL ||
                        "",

                    homeId: null,

                    createdAt:
                        serverTimestamp()
                }
            );


            showNoHome();

            return;
        }


        /*
         * USUARIO EXISTENTE
         */

        const userData =
            userSnap.data();


        if (!userData.homeId) {

            showNoHome();

            return;
        }


        await loadHome(
            userData.homeId
        );


    } catch (error) {

        console.error(
            "Error cargando usuario:",
            error
        );

        loginError.textContent =
            "No se han podido cargar tus datos.";

    }

}


/* =========================================
   MOSTRAR CREACIÓN DE HOGAR
   ========================================= */

function showNoHome() {

    noHome.classList.remove("hidden");

    homeContent.classList.add("hidden");

    privateContent.classList.add("hidden");

}


/* =========================================
   CREAR HOGAR
   ========================================= */

createHome.addEventListener("click", async () => {

    const user =
        auth.currentUser;

    if (!user) return;


    const name =
        homeNameInput.value.trim();


    if (!name) {

        alert(
            "Introduce un nombre para el hogar."
        );

        return;
    }


    try {

        /*
         * CREAR HOGAR
         */

        const homeRef =
            await addDoc(
                collection(db, "homes"),
                {

                    name: name,

                    ownerId: user.uid,

                    createdAt:
                        serverTimestamp()

                }
            );


        /*
         * AÑADIR PROPIETARIO
         * COMO MIEMBRO
         */

        await setDoc(

            doc(
                db,
                "homes",
                homeRef.id,
                "members",
                user.uid
            ),

            {

                uid: user.uid,

                name:
                    user.displayName ||
                    "Usuario",

                email:
                    user.email ||
                    "",

                role: "owner",

                joinedAt:
                    serverTimestamp()

            }

        );


        /*
         * GUARDAR HOME ID
         * EN EL USUARIO
         */

        await setDoc(

            doc(
                db,
                "users",
                user.uid
            ),

            {

                homeId:
                    homeRef.id

            },

            {

                merge: true

            }

        );


        await loadHome(
            homeRef.id
        );


    } catch (error) {

        console.error(
            "Error creando hogar:",
            error
        );

        alert(
            "No se ha podido crear el hogar."
        );

    }

});


/* =========================================
   CARGAR HOGAR
   ========================================= */

async function loadHome(homeId) {

    try {

        const homeRef =
            doc(
                db,
                "homes",
                homeId
            );

        const homeSnap =
            await getDoc(homeRef);


        if (!homeSnap.exists()) {

            showNoHome();

            return;
        }


        const home =
            homeSnap.data();


        homeNameDisplay.textContent =
            home.name;


        noHome.classList.add("hidden");

        homeContent.classList.remove("hidden");

        privateContent.classList.add("hidden");


    } catch (error) {

        console.error(
            "Error cargando hogar:",
            error
        );

    }

}


/* =========================================
   CUENTA PRIVADA
   ========================================= */

privateButton.addEventListener(
    "click",
    () => {

        homeContent.classList.add("hidden");

        privateContent.classList.remove(
            "hidden"
        );

    }
);


backHome.addEventListener(
    "click",
    () => {

        privateContent.classList.add(
            "hidden"
        );

        homeContent.classList.remove(
            "hidden"
        );

    }
);


/* =========================================
   SERVICE WORKER
   ========================================= */

if ("serviceWorker" in navigator) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker.register(
                "service-worker.js"
            ).catch(error => {

                console.error(
                    "Error registrando Service Worker:",
                    error
                );

            });

        }
    );

}
