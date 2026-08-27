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
    serverTimestamp,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   FIREBASE
========================================== */

const firebaseConfig = {

    apiKey:
        "AIzaSyA1oKOXWYqauiGL4N8Oh3mG3JMP5ZFCxGw",

    authDomain:
        "finanzas-hogar-803fd.firebaseapp.com",

    projectId:
        "finanzas-hogar-803fd",

    storageBucket:
        "finanzas-hogar-803fd.firebasestorage.app",

    messagingSenderId:
        "461089916272",

    appId:
        "1:461089916272:web:c0755eddab52ea08673bb5"

};


const app =
    initializeApp(firebaseConfig);

const auth =
    getAuth(app);

const db =
    getFirestore(app);

const googleProvider =
    new GoogleAuthProvider();


/* ==========================================
   ESTADO
========================================== */

let currentUser = null;

let currentHomeId = null;

let movementType = "expense";


/* ==========================================
   ELEMENTOS
========================================== */

const loginScreen =
    document.getElementById(
        "login-screen"
    );

const appScreen =
    document.getElementById(
        "app-screen"
    );

const googleLogin =
    document.getElementById(
        "google-login"
    );

const logoutButton =
    document.getElementById(
        "logout-button"
    );

const loginError =
    document.getElementById(
        "login-error"
    );

const userName =
    document.getElementById(
        "user-name"
    );

const noHome =
    document.getElementById(
        "no-home"
    );

const homeContent =
    document.getElementById(
        "home-content"
    );

const homeNameInput =
    document.getElementById(
        "home-name"
    );

const homeNameDisplay =
    document.getElementById(
        "home-name-display"
    );

const createHome =
    document.getElementById(
        "create-home"
    );

const bottomNav =
    document.getElementById(
        "bottom-nav"
    );


/* ==========================================
   LOGIN
========================================== */

googleLogin.addEventListener(
    "click",
    async () => {

        loginError.textContent = "";

        try {

            await signInWithPopup(
                auth,
                googleProvider
            );

        } catch (error) {

            console.error(error);

            loginError.textContent =
                "No se ha podido iniciar sesión.";

        }

    }
);


/* ==========================================
   LOGOUT
========================================== */

logoutButton.addEventListener(
    "click",
    async () => {

        await signOut(auth);

    }
);


/* ==========================================
   AUTENTICACIÓN
========================================== */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            currentUser = null;

            currentHomeId = null;

            loginScreen.classList.remove(
                "hidden"
            );

            appScreen.classList.add(
                "hidden"
            );

            bottomNav.classList.add(
                "hidden"
            );

            return;
        }


        currentUser = user;


        loginScreen.classList.add(
            "hidden"
        );

        appScreen.classList.remove(
            "hidden"
        );

        bottomNav.classList.remove(
            "hidden"
        );


        userName.textContent =
            user.displayName ||
            "Usuario";


        await loadUser(user);

    }
);


/* ==========================================
   USUARIO
========================================== */

async function loadUser(user) {

    try {

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );

        const snapshot =
            await getDoc(userRef);


        if (!snapshot.exists()) {

            await setDoc(
                userRef,
                {

                    uid:
                        user.uid,

                    name:
                        user.displayName ||
                        "Usuario",

                    email:
                        user.email ||
                        "",

                    photoURL:
                        user.photoURL ||
                        "",

                    homeId:
                        null,

                    createdAt:
                        serverTimestamp()

                }
            );


            showNoHome();

            return;
        }


        const data =
            snapshot.data();


        if (!data.homeId) {

            showNoHome();

            return;
        }


        currentHomeId =
            data.homeId;


        await loadHome(
            currentHomeId
        );

    } catch (error) {

        console.error(error);

        loginError.textContent =
            "Error cargando los datos.";

    }

}


/* ==========================================
   SIN HOGAR
========================================== */

function showNoHome() {

    noHome.classList.remove(
        "hidden"
    );

    homeContent.classList.add(
        "hidden"
    );

}


/* ==========================================
   CREAR HOGAR
========================================== */

createHome.addEventListener(
    "click",
    async () => {

        if (!currentUser) return;


        const name =
            homeNameInput.value.trim();


        if (!name) {

            alert(
                "Introduce un nombre."
            );

            return;
        }


        try {

            const homeRef =
                await addDoc(
                    collection(
                        db,
                        "homes"
                    ),
                    {

                        name,

                        ownerId:
                            currentUser.uid,

                        createdAt:
                            serverTimestamp()

                    }
                );


            await setDoc(

                doc(
                    db,
                    "homes",
                    homeRef.id,
                    "members",
                    currentUser.uid
                ),

                {

                    uid:
                        currentUser.uid,

                    name:
                        currentUser.displayName ||
                        "Usuario",

                    email:
                        currentUser.email ||
                        "",

                    role:
                        "owner",

                    joinedAt:
                        serverTimestamp()

                }

            );


            await setDoc(

                doc(
                    db,
                    "users",
                    currentUser.uid
                ),

                {

                    homeId:
                        homeRef.id

                },

                {

                    merge:
                        true

                }

            );


            currentHomeId =
                homeRef.id;


            await loadHome(
                currentHomeId
            );


        } catch (error) {

            console.error(error);

            alert(
                "No se ha podido crear el hogar."
            );

        }

    }
);


/* ==========================================
   CARGAR HOGAR
========================================== */

async function loadHome(homeId) {

    const homeRef =
        doc(
            db,
            "homes",
            homeId
        );


    const snapshot =
        await getDoc(homeRef);


    if (!snapshot.exists()) {

        showNoHome();

        return;
    }


    const home =
        snapshot.data();


    homeNameDisplay.textContent =
        home.name;


    noHome.classList.add(
        "hidden"
    );

    homeContent.classList.remove(
        "hidden"
    );


    loadMovements(homeId);

    loadMembers(homeId);

}


/* ==========================================
   NAVEGACIÓN
========================================== */

function showSection(
    section
) {

    const sections =
        document.querySelectorAll(
            ".app-section"
        );


    sections.forEach(
        element => {

            element.classList.add(
                "hidden"
            );

        }
    );


    homeContent.classList.add(
        "hidden"
    );

    noHome.classList.add(
        "hidden"
    );


    if (section === "home") {

        homeContent.classList.remove(
            "hidden"
        );

        return;
    }


    const target =
        document.getElementById(
            `${section}-content`
        );


    if (target) {

        target.classList.remove(
            "hidden"
        );

    }

}


/* Todos los botones con data-section */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-section]"
            );


        if (!button) return;


        showSection(
            button.dataset.section
        );

    }
);


/* ==========================================
   TIPO MOVIMIENTO
========================================== */

const expenseType =
    document.getElementById(
        "expense-type"
    );

const incomeType =
    document.getElementById(
        "income-type"
    );


expenseType.addEventListener(
    "click",
    () => {

        movementType =
            "expense";

        expenseType.classList.add(
            "active"
        );

        incomeType.classList.remove(
            "active"
        );

    }
);


incomeType.addEventListener(
    "click",
    () => {

        movementType =
            "income";

        incomeType.classList.add(
            "active"
        );

        expenseType.classList.remove(
            "active"
        );

    }
);


/* ==========================================
   GUARDAR MOVIMIENTO
========================================== */

document
    .getElementById(
        "save-movement"
    )
    .addEventListener(
        "click",
        async () => {

            if (!currentUser ||
                !currentHomeId) {

                alert(
                    "No hay un hogar activo."
                );

                return;
            }


            const description =
                document.getElementById(
                    "movement-description"
                ).value.trim();


            const amount =
                Number(
                    document.getElementById(
                        "movement-amount"
                    ).value
                );


            const category =
                document.getElementById(
                    "movement-category"
                ).value;


            const date =
                document.getElementById(
                    "movement-date"
                ).value;


            if (!description ||
                !amount ||
                amount <= 0 ||
                !date) {

                alert(
                    "Completa descripción, importe y fecha."
                );

                return;
            }


            try {

                await addDoc(

                    collection(
                        db,
                        "homes",
                        currentHomeId,
                        "sharedTransactions"
                    ),

                    {

                        homeId:
                            currentHomeId,

                        createdBy:
                            currentUser.uid,

                        createdByName:
                            currentUser.displayName ||
                            "Usuario",

                        type:
                            movementType,

                        description,

                        amount,

                        category:
                            category ||
                            "otros",

                        date,

                        createdAt:
                            serverTimestamp()

                    }

                );


                document.getElementById(
                    "movement-description"
                ).value = "";


                document.getElementById(
                    "movement-amount"
                ).value = "";


                document.getElementById(
                    "movement-category"
                ).value = "";


                alert(
                    "Movimiento guardado."
                );


                showSection(
                    "home"
                );


            } catch (error) {

                console.error(error);

                alert(
                    "No se ha podido guardar el movimiento."
                );

            }

        }
    );


/* ==========================================
   MOVIMIENTOS
========================================== */

function loadMovements(homeId) {

    const list =
        document.getElementById(
            "movements-list"
        );


    const transactionsRef =
        collection(
            db,
            "homes",
            homeId,
            "sharedTransactions"
        );


    const transactionsQuery =
        query(
            transactionsRef,
            orderBy(
                "date",
                "desc"
            )
        );


    onSnapshot(

        transactionsQuery,

        snapshot => {

            list.innerHTML = "";


            let income = 0;

            let expenses = 0;


            if (snapshot.empty) {

                list.innerHTML =
                    `<div class="empty-state">
                        No hay movimientos todavía.
                    </div>`;

            }


            snapshot.forEach(
                transaction => {

                    const data =
                        transaction.data();


                    const amount =
                        Number(
                            data.amount
                        );


                    if (
                        data.type ===
                        "income"
                    ) {

                        income += amount;

                    } else {

                        expenses += amount;

                    }


                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "card";


                    const sign =
                        data.type ===
                        "income"
                            ? "+"
                            : "-";


                    item.innerHTML = `

                        <div
                            style="
                            display:flex;
                            justify-content:space-between;
                            gap:10px;
                            "
                        >

                            <div>

                                <strong
                                    style="font-size:16px"
                                >
                                    ${escapeHtml(
                                        data.description
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        data.category ||
                                        "Otros"
                                    )}
                                    ·
                                    ${escapeHtml(
                                        data.date ||
                                        ""
                                    )}
                                </small>

                            </div>

                            <strong
                                class="${
                                    data.type ===
                                    "income"
                                    ? "positive"
                                    : "negative"
                                }"
                            >
                                ${sign}
                                ${formatMoney(
                                    amount
                                )}
                            </strong>

                        </div>
                    `;


                    list.appendChild(
                        item
                    );

                }
            );


            document.getElementById(
                "shared-income"
            ).textContent =
                formatMoney(income);


            document.getElementById(
                "shared-expenses"
            ).textContent =
                formatMoney(expenses);


            document.getElementById(
                "monthly-balance"
            ).textContent =
                formatMoney(
                    income - expenses
                );

        },

        error => {

            console.error(
                "Error leyendo movimientos:",
                error
            );

            list.innerHTML =
                `<div class="empty-state">
                    No se han podido cargar los movimientos.
                </div>`;

        }

    );

}


/* ==========================================
   MIEMBROS
========================================== */

function loadMembers(homeId) {

    const list =
        document.getElementById(
            "members-list"
        );


    const membersRef =
        collection(
            db,
            "homes",
            homeId,
            "members"
        );


    onSnapshot(

        membersRef,

        snapshot => {

            list.innerHTML = "";


            snapshot.forEach(
                member => {

                    const data =
                        member.data();


                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "card";


                    item.innerHTML = `

                        <strong>
                            ${escapeHtml(
                                data.name ||
                                "Usuario"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                data.email ||
                                ""
                            )}
                        </small>

                        <small>
                            ${data.role === "owner"
                                ? "Administrador"
                                : "Miembro"}
                        </small>

                    `;


                    list.appendChild(
                        item
                    );

                }
            );

        }

    );

}


/* ==========================================
   INVITACIONES
========================================== */

document
    .getElementById(
        "send-invitation"
    )
    .addEventListener(
        "click",
        async () => {

            const email =
                document.getElementById(
                    "invite-email"
                ).value
                .trim()
                .toLowerCase();


            const result =
                document.getElementById(
                    "invite-result"
                );


            if (!email) {

                result.textContent =
                    "Introduce un correo.";

                return;
            }


            if (!currentHomeId ||
                !currentUser) {

                return;
            }


            try {

                await addDoc(

                    collection(
                        db,
                        "invitations"
                    ),

                    {

                        email,

                        homeId:
                            currentHomeId,

                        createdBy:
                            currentUser.uid,

                        status:
                            "pending",

                        createdAt:
                            serverTimestamp()

                    }

                );


                result.textContent =
                    "Invitación creada correctamente.";


                document.getElementById(
                    "invite-email"
                ).value = "";


            } catch (error) {

                console.error(error);

                result.textContent =
                    "No se ha podido crear la invitación.";

            }

        }
    );


/* ==========================================
   UTILIDADES
========================================== */

function formatMoney(
    amount
) {

    return new Intl.NumberFormat(
        "es-ES",
        {
            style: "currency",
            currency: "EUR"
        }
    ).format(amount);

}


function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(value ?? "");


    return div.innerHTML;

}


/* ==========================================
   FECHA POR DEFECTO
========================================== */

const dateInput =
    document.getElementById(
        "movement-date"
    );


if (dateInput) {

    const today =
        new Date()
            .toISOString()
            .split("T")[0];

    dateInput.value =
        today;

}


/* ==========================================
   SERVICE WORKER
========================================== */

if (
    "serviceWorker"
    in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "service-worker.js"
                )
                .catch(
                    error =>
                        console.error(
                            error
                        )
                );

        }
    );

}
