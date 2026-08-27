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
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =====================================================
   FIREBASE
===================================================== */

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


const firebaseApp =
  initializeApp(firebaseConfig);


const auth =
  getAuth(firebaseApp);


const db =
  getFirestore(firebaseApp);


const googleProvider =
  new GoogleAuthProvider();


/* =====================================================
   ESTADO
===================================================== */

let currentUser = null;

let currentHomeId = null;

let sharedMovementType = "expense";

let privateMovementType = "expense";

let recurringType = "expense";

let listeners = [];


/* =====================================================
   UTILIDADES
===================================================== */

function $(id) {

  return document.getElementById(id);

}


function money(value) {

  return new Intl.NumberFormat(
    "es-ES",
    {
      style: "currency",
      currency: "EUR"
    }
  ).format(
    Number(value) || 0
  );

}


function today() {

  return new Date()
    .toISOString()
    .split("T")[0];

}


function escapeHTML(value) {

  const div =
    document.createElement("div");

  div.textContent =
    String(value ?? "");

  return div.innerHTML;

}


function toast(message) {

  const element =
    $("toast");

  element.textContent =
    message;

  element.classList.add(
    "show"
  );

  setTimeout(
    () =>
      element.classList.remove(
        "show"
      ),
    2500
  );

}


function clearListeners() {

  listeners.forEach(
    unsubscribe => {

      if (
        typeof unsubscribe ===
        "function"
      ) {

        unsubscribe();

      }

    }
  );

  listeners = [];

}


/* =====================================================
   NAVEGACIÓN
===================================================== */

function showSection(section) {

  const screens = [

    "create-home-screen",
    "home-screen",
    "movements-screen",
    "goals-screen",
    "recurring-screen",
    "members-screen",
    "split-screen",
    "private-screen"

  ];


  screens.forEach(
    screen => {

      $(screen)
        .classList
        .add("hidden");

    }
  );


  if (section === "home") {

    $("home-screen")
      .classList
      .remove("hidden");

  }

  else if (section === "movements") {

    $("movements-screen")
      .classList
      .remove("hidden");

  }

  else if (section === "goals") {

    $("goals-screen")
      .classList
      .remove("hidden");

  }

  else if (section === "recurring") {

    $("recurring-screen")
      .classList
      .remove("hidden");

  }

  else if (section === "members") {

    $("members-screen")
      .classList
      .remove("hidden");

  }

  else if (section === "split") {

    $("split-screen")
      .classList
      .remove("hidden");

  }

  else if (section === "private") {

    $("private-screen")
      .classList
      .remove("hidden");

  }


  window.scrollTo(
    0,
    0
  );

}


document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-section]"
      );


    if (!button) {
      return;
    }


    showSection(
      button.dataset.section
    );

  }
);


/* =====================================================
   LOGIN GOOGLE
===================================================== */

$("google-login").addEventListener(
  "click",
  async () => {

    $("login-error")
      .textContent = "";

    try {

      await signInWithPopup(
        auth,
        googleProvider
      );

    }

    catch (error) {

      console.error(error);

      $("login-error")
        .textContent =
        "No se ha podido iniciar sesión con Google.";

    }

  }
);


/* =====================================================
   LOGOUT
===================================================== */

$("logout-button").addEventListener(
  "click",
  async () => {

    await signOut(auth);

  }
);


/* =====================================================
   AUTENTICACIÓN
===================================================== */

onAuthStateChanged(
  auth,
  async user => {

    clearListeners();

    currentUser =
      user;

    currentHomeId =
      null;


    if (!user) {

      $("login-screen")
        .classList
        .remove("hidden");

      $("app-screen")
        .classList
        .add("hidden");

      return;

    }


    $("login-screen")
      .classList
      .add("hidden");

    $("app-screen")
      .classList
      .remove("hidden");


    $("user-name")
      .textContent =
      user.displayName ||
      "Usuario";


    await loadUser();

  }
);


/* =====================================================
   USUARIO
===================================================== */

async function loadUser() {

  const userRef =
    doc(
      db,
      "users",
      currentUser.uid
    );


  const snapshot =
    await getDoc(
      userRef
    );


  if (!snapshot.exists()) {

    await setDoc(
      userRef,
      {

        uid:
          currentUser.uid,

        name:
          currentUser.displayName ||
          "Usuario",

        email:
          currentUser.email ||
          "",

        photoURL:
          currentUser.photoURL ||
          "",

        homeId:
          null,

        createdAt:
          serverTimestamp()

      }
    );


    showCreateHome();

    return;

  }


  currentHomeId =
    snapshot.data().homeId ||
    null;


  if (!currentHomeId) {

    showCreateHome();

    return;

  }


  await loadHome();

}


/* =====================================================
   CREAR HOGAR
===================================================== */

function showCreateHome() {

  $("create-home-screen")
    .classList
    .remove("hidden");

}


$("create-home-button")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("new-home-name")
          .value
          .trim();


      if (!name) {

        toast(
          "Introduce un nombre para el hogar."
        );

        return;

      }


      try {

        const homeReference =
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


        currentHomeId =
          homeReference.id;


        await setDoc(
          doc(
            db,
            "homes",
            currentHomeId,
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


        await updateDoc(
          doc(
            db,
            "users",
            currentUser.uid
          ),
          {

            homeId:
              currentHomeId

          }
        );


        await loadHome();

        toast(
          "Hogar creado correctamente."
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido crear el hogar."
        );

      }

    }
  );


/* =====================================================
   CARGAR HOGAR
===================================================== */

async function loadHome() {

  const homeReference =
    doc(
      db,
      "homes",
      currentHomeId
    );


  const snapshot =
    await getDoc(
      homeReference
    );


  if (!snapshot.exists()) {

    currentHomeId =
      null;

    showCreateHome();

    return;

  }


  $("home-title")
    .textContent =
    snapshot.data().name;


  $("create-home-screen")
    .classList
    .add("hidden");


  subscribeSharedTransactions();

  subscribeGoals();

  subscribeRecurring();

  subscribeMembers();

  subscribeInvitations();

  subscribePrivateData();

  showSection(
    "home"
  );

}


/* =====================================================
   MOVIMIENTOS COMPARTIDOS
===================================================== */

$("shared-date")
  .value =
  today();


$("shared-expense-button")
  .addEventListener(
    "click",
    () => {

      sharedMovementType =
        "expense";

      $("shared-expense-button")
        .classList
        .add("active");

      $("shared-income-button")
        .classList
        .remove("active");

    }
  );


$("shared-income-button")
  .addEventListener(
    "click",
    () => {

      sharedMovementType =
        "income";

      $("shared-income-button")
        .classList
        .add("active");

      $("shared-expense-button")
        .classList
        .remove("active");

    }
  );


$("save-shared-button")
  .addEventListener(
    "click",
    async () => {

      const description =
        $("shared-description")
          .value
          .trim();


      const amount =
        Number(
          $("shared-amount")
            .value
        );


      const date =
        $("shared-date")
          .value;


      if (
        !description ||
        amount <= 0 ||
        !date
      ) {

        toast(
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
              sharedMovementType,

            description,

            amount,

            category:
              $("shared-category")
                .value,

            date,

            createdAt:
              serverTimestamp()

          }
        );


        $("shared-description")
          .value = "";

        $("shared-amount")
          .value = "";


        toast(
          "Movimiento guardado."
        );

        showSection(
          "movements"
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido guardar."
        );

      }

    }
  );


function subscribeSharedTransactions() {

  const reference =
    collection(
      db,
      "homes",
      currentHomeId,
      "sharedTransactions"
    );


  listeners.push(

    onSnapshot(
      reference,
      snapshot => {

        let income = 0;

        let expenses = 0;

        const rows = [];


        snapshot.forEach(
          item => {

            const data =
              item.data();


            rows.push({
              id:
                item.id,
              ...data
            });


            if (
              data.type ===
              "income"
            ) {

              income +=
                Number(
                  data.amount
                ) || 0;

            }

            else {

              expenses +=
                Number(
                  data.amount
                ) || 0;

            }

          }
        );


        rows.sort(
          (a,b) =>
            String(
              b.date || ""
            ).localeCompare(
              String(
                a.date || ""
              )
            )
        );


        $("home-income")
          .textContent =
          money(income);


        $("home-expenses")
          .textContent =
          money(expenses);


        $("home-balance")
          .textContent =
          money(
            income -
            expenses
          );


        const list =
          $("shared-movements-list");


        if (!rows.length) {

          list.innerHTML =
            `<div class="empty">
              No hay movimientos todavía.
            </div>`;

          return;

        }


        list.innerHTML =
          rows.map(
            row => `

              <article class="card row">

                <div>

                  <strong>
                    ${escapeHTML(
                      row.description
                    )}
                  </strong>

                  <small>
                    ${escapeHTML(
                      row.category ||
                      "otros"
                    )}
                    ·
                    ${escapeHTML(
                      row.date ||
                      ""
                    )}
                    ·
                    ${escapeHTML(
                      row.createdByName ||
                      ""
                    )}
                  </small>

                </div>

                <strong
                  class="${
                    row.type === "income"
                      ? "positive"
                      : "negative"
                  }"
                >
                  ${
                    row.type === "income"
                      ? "+"
                      : "-"
                  }${money(
                    row.amount
                  )}
                </strong>

              </article>

            `
          ).join("");

      },

      error => {

        console.error(error);

      }

    )

  );

}


/* =====================================================
   OBJETIVOS COMPARTIDOS
===================================================== */

$("save-goal-button")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("goal-name")
          .value
          .trim();


      const target =
        Number(
          $("goal-target")
            .value
        );


      if (
        !name ||
        target <= 0
      ) {

        toast(
          "Completa nombre e importe."
        );

        return;

      }


      try {

        await addDoc(
          collection(
            db,
            "homes",
            currentHomeId,
            "sharedGoals"
          ),
          {

            homeId:
              currentHomeId,

            name,

            target,

            saved:
              0,

            createdBy:
              currentUser.uid,

            createdAt:
              serverTimestamp()

          }
        );


        $("goal-name")
          .value = "";

        $("goal-target")
          .value = "";


        toast(
          "Objetivo creado."
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido crear."
        );

      }

    }
  );


function subscribeGoals() {

  listeners.push(

    onSnapshot(
      collection(
        db,
        "homes",
        currentHomeId,
        "sharedGoals"
      ),
      snapshot => {

        const list =
          $("goals-list");


        if (snapshot.empty) {

          list.innerHTML =
            `<div class="empty">
              No hay objetivos.
            </div>`;

          return;

        }


        list.innerHTML =
          snapshot.docs
            .map(
              item => {

                const data =
                  item.data();


                const target =
                  Number(
                    data.target
                  ) || 0;


                const saved =
                  Number(
                    data.saved
                  ) || 0;


                const percentage =
                  target > 0
                    ? Math.min(
                        100,
                        (
                          saved /
                          target
                        ) * 100
                      )
                    : 0;


                return `

                  <article class="card">

                    <strong>
                      ${escapeHTML(
                        data.name
                      )}
                    </strong>

                    <small>
                      ${money(saved)}
                      de
                      ${money(target)}
                    </small>

                    <div class="progress">

                      <div
                        style="
                          width:${percentage}%
                        "
                      ></div>

                    </div>

                    <small>
                      ${percentage.toFixed(0)}%
                    </small>

                  </article>

                `;

              }
            )
            .join("");

      }
    )

  );

}


/* =====================================================
   RECURRENTES
===================================================== */

$("recurring-expense-button")
  .addEventListener(
    "click",
    () => {

      recurringType =
        "expense";

      $("recurring-expense-button")
        .classList
        .add("active");

      $("recurring-income-button")
        .classList
        .remove("active");

    }
  );


$("recurring-income-button")
  .addEventListener(
    "click",
    () => {

      recurringType =
        "income";

      $("recurring-income-button")
        .classList
        .add("active");

      $("recurring-expense-button")
        .classList
        .remove("active");

    }
  );


$("save-recurring-button")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("recurring-name")
          .value
          .trim();


      const amount =
        Number(
          $("recurring-amount")
            .value
        );


      const day =
        Number(
          $("recurring-day")
            .value
        );


      if (
        !name ||
        amount <= 0 ||
        day < 1 ||
        day > 31
      ) {

        toast(
          "Revisa concepto, importe y día."
        );

        return;

      }


      try {

        await addDoc(
          collection(
            db,
            "homes",
            currentHomeId,
            "recurringTransactions"
          ),
          {

            homeId:
              currentHomeId,

            name,

            amount,

            day,

            type:
              recurringType,

            createdBy:
              currentUser.uid,

            createdAt:
              serverTimestamp()

          }
        );


        $("recurring-name")
          .value = "";

        $("recurring-amount")
          .value = "";

        $("recurring-day")
          .value = "";


        toast(
          "Recurrente guardado."
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido guardar."
        );

      }

    }
  );


function subscribeRecurring() {

  listeners.push(

    onSnapshot(
      collection(
        db,
        "homes",
        currentHomeId,
        "recurringTransactions"
      ),
      snapshot => {

        const list =
          $("recurring-list");


        if (snapshot.empty) {

          list.innerHTML =
            `<div class="empty">
              No hay movimientos recurrentes.
            </div>`;

          return;

        }


        list.innerHTML =
          snapshot.docs
            .map(
              item => {

                const data =
                  item.data();


                return `

                  <article class="card row">

                    <div>

                      <strong>
                        ${escapeHTML(
                          data.name
                        )}
                      </strong>

                      <small>
                        Día
                        ${escapeHTML(
                          data.day
                        )}
                      </small>

                    </div>

                    <strong
                      class="${
                        data.type === "income"
                          ? "positive"
                          : "negative"
                      }"
                    >
                      ${
                        data.type === "income"
                          ? "+"
                          : "-"
                      }${money(
                        data.amount
                      )}
                    </strong>

                  </article>

                `;

              }
            )
            .join("");

      }
    )

  );

}


/* =====================================================
   MIEMBROS
===================================================== */

function subscribeMembers() {

  listeners.push(

    onSnapshot(
      collection(
        db,
        "homes",
        currentHomeId,
        "members"
      ),
      snapshot => {

        const list =
          $("members-list");


        list.innerHTML =
          snapshot.docs
            .map(
              item => {

                const data =
                  item.data();


                return `

                  <article class="card row">

                    <div>

                      <strong>
                        ${escapeHTML(
                          data.name ||
                          "Usuario"
                        )}
                      </strong>

                      <small>
                        ${escapeHTML(
                          data.email ||
                          ""
                        )}
                      </small>

                    </div>

                    <span>
                      ${
                        data.role ===
                        "owner"
                          ? "Administrador"
                          : "Miembro"
                      }
                    </span>

                  </article>

                `;

              }
            )
            .join("");

      }
    )

  );

}


/* =====================================================
   INVITACIONES
===================================================== */

$("invite-button")
  .addEventListener(
    "click",
    async () => {

      const email =
        $("invite-email")
          .value
          .trim()
          .toLowerCase();


      if (
        !email ||
        !email.includes("@")
      ) {

        toast(
          "Introduce un correo válido."
        );

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


        $("invite-email")
          .value = "";


        $("invite-message")
          .textContent =
          "Invitación creada correctamente.";


        toast(
          "Invitación creada."
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido crear la invitación."
        );

      }

    }
  );


function subscribeInvitations() {

  listeners.push(

    onSnapshot(
      collection(
        db,
        "invitations"
      ),
      snapshot => {

        const documents =
          snapshot.docs.map(
            item => ({
              id:
                item.id,
              ...item.data()
            })
          );


        const sent =
          documents.filter(
            item =>
              item.createdBy ===
              currentUser.uid
              &&
              item.homeId ===
              currentHomeId
              &&
              item.status ===
              "pending"
          );


        $("pending-invitations")
          .innerHTML =
          sent.length
            ? `

              <h2>
                Invitaciones pendientes
              </h2>

              ${
                sent.map(
                  item => `

                    <article class="card">

                      <strong>
                        Invitación pendiente
                      </strong>

                      <small>
                        ${escapeHTML(
                          item.email
                        )}
                      </small>

                    </article>

                  `
                ).join("")
              }

            `
            : "";


        const received =
          documents.filter(
            item =>
              item.email ===
              (
                currentUser.email ||
                ""
              ).toLowerCase()
              &&
              item.status ===
              "pending"
          );


        $("received-invitations")
          .innerHTML =
          received.length
            ? `

              <h2>
                Invitaciones recibidas
              </h2>

              ${
                received.map(
                  item => `

                    <article class="card">

                      <strong>
                        Invitación a un hogar
                      </strong>

                      <small>
                        ${escapeHTML(
                          item.email
                        )}
                      </small>

                      <button
                        class="primary-button accept-invitation"
                        data-id="${item.id}"
                        data-home="${item.homeId}"
                      >
                        Aceptar invitación
                      </button>

                    </article>

                  `
                ).join("")
              }

            `
            : "";

      }
    )

  );

}


document.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        ".accept-invitation"
      );


    if (!button) {
      return;
    }


    try {

      await setDoc(
        doc(
          db,
          "homes",
          button.dataset.home,
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
            "member",

          joinedAt:
            serverTimestamp()

        }
      );


      await updateDoc(
        doc(
          db,
          "users",
          currentUser.uid
        ),
        {

          homeId:
            button.dataset.home

        }
      );


      await updateDoc(
        doc(
          db,
          "invitations",
          button.dataset.id
        ),
        {

          status:
            "accepted",

          acceptedBy:
            currentUser.uid,

          acceptedAt:
            serverTimestamp()

        }
      );


      currentHomeId =
        button.dataset.home;


      await loadHome();


      toast(
        "Invitación aceptada."
      );

    }

    catch (error) {

      console.error(error);

      toast(
        "No se ha podido aceptar la invitación."
      );

    }

  }
);


/* =====================================================
   REPARTO
===================================================== */

function updateSplit() {

  const list =
    $("split-list");


  list.innerHTML =
    `<div class="empty">
      El reparto se calculará con los movimientos
      registrados por cada miembro.
    </div>`;

}


setInterval(
  updateSplit,
  1000
);


/* =====================================================
   DATOS PRIVADOS
===================================================== */

$("private-date")
  .value =
  today();


$("private-expense-button")
  .addEventListener(
    "click",
    () => {

      privateMovementType =
        "expense";

      $("private-expense-button")
        .classList
        .add("active");

      $("private-income-button")
        .classList
        .remove("active");

    }
  );


$("private-income-button")
  .addEventListener(
    "click",
    () => {

      privateMovementType =
        "income";

      $("private-income-button")
        .classList
        .add("active");

      $("private-expense-button")
        .classList
        .remove("active");

    }
  );


/* CUENTA PRIVADA */

$("save-private-account")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("private-account-name")
          .value
          .trim();


      const balance =
        Number(
          $("private-account-balance")
            .value
        ) || 0;


      if (!name) {

        toast(
          "Escribe el nombre de la cuenta."
        );

        return;

      }


      try {

        await addDoc(
          collection(
            db,
            "users",
            currentUser.uid,
            "privateAccounts"
          ),
          {

            userId:
              currentUser.uid,

            name,

            balance,

            createdAt:
              serverTimestamp()

          }
        );


        $("private-account-name")
          .value = "";

        $("private-account-balance")
          .value = "";


        toast(
          "Cuenta añadida."
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido guardar."
        );

      }

    }
  );


/* MOVIMIENTO PRIVADO */

$("save-private-movement")
  .addEventListener(
    "click",
    async () => {

      const description =
        $("private-description")
          .value
          .trim();


      const amount =
        Number(
          $("private-amount")
            .value
        );


      const date =
        $("private-date")
          .value;


      if (
        !description ||
        amount <= 0 ||
        !date
      ) {

        toast(
          "Completa descripción, importe y fecha."
        );

        return;

      }


      try {

        await addDoc(
          collection(
            db,
            "users",
            currentUser.uid,
            "privateTransactions"
          ),
          {

            userId:
              currentUser.uid,

            type:
              privateMovementType,

            description,

            amount,

            category:
              $("private-category")
                .value,

            date,

            createdAt:
              serverTimestamp()

          }
        );


        $("private-description")
          .value = "";

        $("private-amount")
          .value = "";


        toast(
          "Movimiento privado guardado."
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido guardar."
        );

      }

    }
  );


/* OBJETIVO PRIVADO */

$("save-private-goal")
  .addEventListener(
    "click",
    async () => {

      const name =
        $("private-goal-name")
          .value
          .trim();


      const target =
        Number(
          $("private-goal-target")
            .value
        );


      const saved =
        Number(
          $("private-goal-saved")
            .value
        ) || 0;


      if (
        !name ||
        target <= 0 ||
        saved < 0
      ) {

        toast(
          "Completa correctamente los datos."
        );

        return;

      }


      try {

        await addDoc(
          collection(
            db,
            "users",
            currentUser.uid,
            "privateGoals"
          ),
          {

            userId:
              currentUser.uid,

            name,

            target,

            saved,

            createdAt:
              serverTimestamp()

          }
        );


        $("private-goal-name")
          .value = "";

        $("private-goal-target")
          .value = "";

        $("private-goal-saved")
          .value = "";


        toast(
          "Objetivo privado creado."
        );

      }

      catch (error) {

        console.error(error);

        toast(
          "No se ha podido crear."
        );

      }

    }
  );


/* =====================================================
   ESCUCHAR DATOS PRIVADOS
===================================================== */

function subscribePrivateData() {


  /* MOVIMIENTOS */

  listeners.push(

    onSnapshot(
      collection(
        db,
        "users",
        currentUser.uid,
        "privateTransactions"
      ),
      snapshot => {

        let income = 0;

        let expenses = 0;

        const rows = [];


        snapshot.forEach(
          item => {

            const data =
              item.data();


            rows.push(data);


            if (
              data.type ===
              "income"
            ) {

              income +=
                Number(
                  data.amount
                ) || 0;

            }

            else {

              expenses +=
                Number(
                  data.amount
                ) || 0;

            }

          }
        );


        $("private-income")
          .textContent =
          money(income);


        $("private-expenses")
          .textContent =
          money(expenses);


        $("private-balance")
          .textContent =
          money(
            income -
            expenses
          );


        rows.sort(
          (a,b) =>
            String(
              b.date || ""
            ).localeCompare(
              String(
                a.date || ""
              )
            )
        );


        $("private-movements-list")
          .innerHTML =
          rows.length

            ? rows.map(
                row => `

                  <article class="card row">

                    <div>

                      <strong>
                        ${escapeHTML(
                          row.description
                        )}
                      </strong>

                      <small>
                        ${escapeHTML(
                          row.category ||
                          "otros"
                        )}
                        ·
                        ${escapeHTML(
                          row.date ||
                          ""
                        )}
                      </small>

                    </div>

                    <strong
                      class="${
                        row.type === "income"
                          ? "positive"
                          : "negative"
                      }"
                    >
                      ${
                        row.type === "income"
                          ? "+"
                          : "-"
                      }${money(
                        row.amount
                      )}
                    </strong>

                  </article>

                `
              ).join("")

            : "";

      }
    )

  );


  /* CUENTAS */

  listeners.push(

    onSnapshot(
      collection(
        db,
        "users",
        currentUser.uid,
        "privateAccounts"
      ),
      snapshot => {

        $("private-accounts-list")
          .innerHTML =

          snapshot.empty

            ? `
              <div class="empty">
                No tienes cuentas privadas.
              </div>
            `

            : snapshot.docs.map(
                item => {

                  const data =
                    item.data();


                  return `

                    <article class="card">

                      <strong>
                        ${escapeHTML(
                          data.name
                        )}
                      </strong>

                      <small>
                        Saldo
                      </small>

                      <strong>
                        ${money(
                          data.balance
                        )}
                      </strong>

                    </article>

                  `;

                }
              ).join("");

      }
    )

  );


  /* OBJETIVOS */

  listeners.push(

    onSnapshot(
      collection(
        db,
        "users",
        currentUser.uid,
        "privateGoals"
      ),
      snapshot => {

        $("private-goals-list")
          .innerHTML =

          snapshot.empty

            ? `
              <div class="empty">
                No tienes objetivos privados.
              </div>
            `

            : snapshot.docs.map(
                item => {

                  const data =
                    item.data();


                  const target =
                    Number(
                      data.target
                    ) || 0;


                  const saved =
                    Number(
                      data.saved
                    ) || 0;


                  const percentage =
                    target > 0

                      ? Math.min(
                          100,
                          (
                            saved /
                            target
                          ) * 100
                        )

                      : 0;


                  return `

                    <article class="card">

                      <strong>
                        ${escapeHTML(
                          data.name
                        )}
                      </strong>

                      <small>
                        ${money(saved)}
                        de
                        ${money(target)}
                      </small>

                      <div class="progress">

                        <div
                          style="
                            width:${percentage}%
                          "
                        ></div>

                      </div>

                      <small>
                        ${percentage.toFixed(0)}%
                      </small>

                    </article>

                  `;

                }
              ).join("");

      }
    )

  );

}


/* =====================================================
   SERVICE WORKER
===================================================== */

if (
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register(
          "./service-worker.js"
        )
        .catch(
          error =>
            console.error(
              "Service Worker:",
              error
            )
        );

    }
  );

}
