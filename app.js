import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});


/* =========================================================
   ESTADO
========================================================= */

let currentUser = null;
let currentHousehold = null;
let currentMembers = [];

let expenses = [];
let contributions = [];

let selectedMonth = getCurrentMonth();
let editingExpenseId = null;

let toastTimer = null;


/* =========================================================
   DOM
========================================================= */

const $ = id => document.getElementById(id);

const setText = (id, value) => {
  const element = $(id);
  if (element) {
    element.textContent = value;
  }
};


/* =========================================================
   ARRANQUE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  initialiseUI();

  onAuthStateChanged(
    auth,
    handleAuthState
  );

});


/* =========================================================
   INTERFAZ
========================================================= */

function initialiseUI() {

  bindEvents();

  setTheme(
    localStorage.getItem("finanzas-theme")
    || "classic"
  );

  if ($("monthSelector")) {
    $("monthSelector").value =
      selectedMonth;
  }

  setText(
    "annualYear",
    new Date().getFullYear()
  );

}


/* =========================================================
   EVENTOS
========================================================= */

function bindEvents() {

  $("googleLogin")
    ?.addEventListener(
      "click",
      loginWithGoogle
    );


  $("logout")
    ?.addEventListener(
      "click",
      logout
    );


  $("settingsLogout")
    ?.addEventListener(
      "click",
      logout
    );


  $("mobileMenu")
    ?.addEventListener(
      "click",
      () => {

        $("sidebar")
          ?.classList.toggle("open");

      }
    );


  document
    .querySelectorAll(".menu-item[data-page]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => navigate(button.dataset.page)
      );

    });


  document
    .querySelectorAll("[data-go]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => navigate(button.dataset.go)
      );

    });


  $("monthSelector")
    ?.addEventListener(
      "change",
      event => {

        selectedMonth =
          event.target.value;

        refreshDashboard();

      }
    );


  $("previousMonth")
    ?.addEventListener(
      "click",
      () => {

        selectedMonth =
          shiftMonth(
            selectedMonth,
            -1
          );

        if ($("monthSelector")) {
          $("monthSelector").value =
            selectedMonth;
        }

        refreshDashboard();

      }
    );


  $("nextMonth")
    ?.addEventListener(
      "click",
      () => {

        selectedMonth =
          shiftMonth(
            selectedMonth,
            1
          );

        if ($("monthSelector")) {
          $("monthSelector").value =
            selectedMonth;
        }

        refreshDashboard();

      }
    );


  $("newExpense")
    ?.addEventListener(
      "click",
      () => openExpenseModal()
    );


  $("expenseForm")
    ?.addEventListener(
      "submit",
      saveExpense
    );


  $("expenseSearch")
    ?.addEventListener(
      "input",
      renderExpenses
    );


  $("expenseFilter")
    ?.addEventListener(
      "change",
      renderExpenses
    );


  $("newContribution")
    ?.addEventListener(
      "click",
      openContributionModal
    );


  $("contributionForm")
    ?.addEventListener(
      "submit",
      saveContribution
    );


  $("generateInvite")
    ?.addEventListener(
      "click",
      generateInvite
    );


  $("joinHousehold")
    ?.addEventListener(
      "click",
      joinHousehold
    );


  $("themeButton")
    ?.addEventListener(
      "click",
      () => navigate("settings")
    );


  document
    .querySelectorAll(".theme-option")
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          setTheme(button.dataset.theme)
      );

    });


  document
    .querySelectorAll(".close-modal")
    .forEach(button => {

      button.addEventListener(
        "click",
        closeModals
      );

    });

}


/* =========================================================
   AUTENTICACIÓN
========================================================= */

async function handleAuthState(user) {

  currentUser = user;

  if (!user) {

    currentHousehold = null;
    currentMembers = [];
    expenses = [];
    contributions = [];

    showLogin();

    return;
  }


  showLoading();


  try {

    await initialiseUser(user);

    await loadHousehold();

    await refreshAll();

    updateUserInterface();

    showApp();

  } catch (error) {

    console.error(
      "Error inicializando aplicación:",
      error
    );

    showLogin();

    toast(
      getFirebaseErrorMessage(error),
      true
    );

  }

}


async function loginWithGoogle() {

  const button =
    $("googleLogin");

  try {

    if (button) {
      button.disabled = true;
    }

    await signInWithPopup(
      auth,
      googleProvider
    );

  } catch (error) {

    console.error(
      "Error de autenticación:",
      error
    );

    if (
      error.code !==
      "auth/popup-closed-by-user"
    ) {

      toast(
        getFirebaseErrorMessage(error),
        true
      );

    }

  } finally {

    if (button) {
      button.disabled = false;
    }

  }

}


async function logout() {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(error);

    toast(
      "No se ha podido cerrar la sesión.",
      true
    );

  }

}


/* =========================================================
   USUARIO
========================================================= */

async function initialiseUser(user) {

  const userRef =
    doc(
      db,
      "users",
      user.uid
    );


  const userSnapshot =
    await getDoc(userRef);


  const userData = {

    uid:
      user.uid,

    name:
      user.displayName
      || "Usuario",

    email:
      user.email
      || "",

    photo:
      user.photoURL
      || "",

    updatedAt:
      serverTimestamp()

  };


  if (!userSnapshot.exists()) {

    await setDoc(
      userRef,
      {
        ...userData,
        createdAt:
          serverTimestamp()
      }
    );

  } else {

    await setDoc(
      userRef,
      userData,
      {
        merge: true
      }
    );

  }


  /*
    Buscar un hogar donde el usuario
    figure como miembro.
  */

  const householdQuery =
    query(
      collection(
        db,
        "households"
      ),
      where(
        "memberIds",
        "array-contains",
        user.uid
      ),
      limit(1)
    );


  const householdSnapshot =
    await getDocs(
      householdQuery
    );


  if (!householdSnapshot.empty) {

    currentHousehold =
      householdSnapshot.docs[0];

  } else {

    currentHousehold =
      await createHousehold(user);

  }

}


/* =========================================================
   CREAR HOGAR
========================================================= */

async function createHousehold(user) {

  const householdRef =
    doc(
      collection(
        db,
        "households"
      )
    );


  const inviteCode =
    await createUniqueInviteCode();


  const memberRef =
    doc(
      db,
      "households",
      householdRef.id,
      "members",
      user.uid
    );


  /*
    Primero creamos el hogar.
  */

  await setDoc(
    householdRef,
    {

      ownerId:
        user.uid,

      name:
        "Mi hogar",

      inviteCode,

      memberIds:
        [user.uid],

      createdAt:
        serverTimestamp()

    }
  );


  /*
    Después creamos al propietario
    como miembro.
  */

  await setDoc(
    memberRef,
    {

      uid:
        user.uid,

      name:
        user.displayName
        || "Usuario",

      email:
        user.email
        || "",

      photo:
        user.photoURL
        || "",

      role:
        "owner",

      joinedAt:
        serverTimestamp()

    }
  );


  /*
    Índice del código de invitación.
  */

  await setDoc(
    doc(
      db,
      "joinCodes",
      inviteCode
    ),
    {

      householdId:
        householdRef.id,

      createdAt:
        serverTimestamp()

    }
  );


  return await getDoc(
    householdRef
  );

}


/* =========================================================
   CÓDIGOS DE INVITACIÓN
========================================================= */

async function createUniqueInviteCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


  for (
    let attempt = 0;
    attempt < 20;
    attempt++
  ) {

    let code = "";


    for (
      let i = 0;
      i < 6;
      i++
    ) {

      code +=
        characters[
          Math.floor(
            Math.random() *
            characters.length
          )
        ];

    }


    const codeRef =
      doc(
        db,
        "joinCodes",
        code
      );


    const snapshot =
      await getDoc(codeRef);


    if (!snapshot.exists()) {
      return code;
    }

  }


  throw new Error(
    "No se ha podido generar un código de invitación."
  );

}


/* =========================================================
   HOGAR
========================================================= */

async function loadHousehold() {

  if (!currentHousehold) {
    return;
  }


  const householdSnapshot =
    await getDoc(
      currentHousehold.ref
    );


  if (!householdSnapshot.exists()) {

    throw new Error(
      "El hogar no existe."
    );

  }


  currentHousehold =
    householdSnapshot;


  const membersSnapshot =
    await getDocs(
      collection(
        db,
        "households",
        currentHousehold.id,
        "members"
      )
    );


  currentMembers =
    membersSnapshot.docs.map(
      item => ({
        id:
          item.id,

        ...item.data()
      })
    );


  renderMembers();

  populateMemberSelectors();


  setText(
    "inviteCode",
    currentHousehold.data().inviteCode
    || "------"
  );

}


async function generateInvite() {

  if (!currentHousehold) {
    return;
  }


  try {

    const newCode =
      await createUniqueInviteCode();


    const oldCode =
      currentHousehold
        .data()
        ?.inviteCode;


    await updateDoc(
      currentHousehold.ref,
      {
        inviteCode:
          newCode
      }
    );


    if (oldCode) {

      await deleteDoc(
        doc(
          db,
          "joinCodes",
          oldCode
        )
      ).catch(
        () => {}
      );

    }


    await setDoc(
      doc(
        db,
        "joinCodes",
        newCode
      ),
      {

        householdId:
          currentHousehold.id,

        createdAt:
          serverTimestamp()

      }
    );


    await loadHousehold();


    toast(
      "Nuevo código generado."
    );

  } catch (error) {

    console.error(error);

    toast(
      getFirebaseErrorMessage(error),
      true
    );

  }

}


/* =========================================================
   UNIRSE A UN HOGAR
========================================================= */

async function joinHousehold() {

  if (!currentUser) {
    return;
  }


  const input =
    $("joinCode");


  const code =
    input?.value
      ?.trim()
      .toUpperCase();


  if (!code) {

    toast(
      "Introduce el código.",
      true
    );

    return;

  }


  if (code.length !== 6) {

    toast(
      "El código debe tener 6 caracteres.",
      true
    );

    return;

  }


  try {

    const joinSnapshot =
      await getDoc(
        doc(
          db,
          "joinCodes",
          code
        )
      );


    if (!joinSnapshot.exists()) {

      toast(
        "El código no es válido.",
        true
      );

      return;

    }


    const householdId =
      joinSnapshot.data().householdId;


    const householdRef =
      doc(
        db,
        "households",
        householdId
      );


    const householdSnapshot =
      await getDoc(
        householdRef
      );


    if (!householdSnapshot.exists()) {

      toast(
        "El hogar no existe.",
        true
      );

      return;

    }


    const memberRef =
      doc(
        db,
        "households",
        householdId,
        "members",
        currentUser.uid
      );


    await setDoc(
      memberRef,
      {

        uid:
          currentUser.uid,

        name:
          currentUser.displayName
          || "Usuario",

        email:
          currentUser.email
          || "",

        photo:
          currentUser.photoURL
          || "",

        role:
          "member",

        inviteCode:
          code,

        joinedAt:
          serverTimestamp()

      }
    );


    const existingIds =
      householdSnapshot
        .data()
        .memberIds
        || [];


    if (
      !existingIds.includes(
        currentUser.uid
      )
    ) {

      await updateDoc(
        householdRef,
        {

          memberIds:
            [
              ...existingIds,
              currentUser.uid
            ]

        }
      );

    }


    currentHousehold =
      await getDoc(
        householdRef
      );


    if (input) {
      input.value = "";
    }


    await loadHousehold();

    await refreshAll();


    toast(
      "Te has unido al hogar correctamente."
    );


    navigate("dashboard");

  } catch (error) {

    console.error(error);

    toast(
      getFirebaseErrorMessage(error),
      true
    );

  }

}


/* =========================================================
   GASTOS
========================================================= */

async function loadExpenses() {

  if (!currentHousehold) {
    return;
  }


  const expensesRef =
    collection(
      db,
      "households",
      currentHousehold.id,
      "expenses"
    );


  const snapshot =
    await getDocs(
      expensesRef
    );


  expenses =
    snapshot.docs
      .map(
        item => ({
          id:
            item.id,

          ...item.data()
        })
      )
      .sort(
        (a, b) =>
          String(
            b.date || ""
          ).localeCompare(
            String(
              a.date || ""
            )
          )
      );


  renderExpenses();

}


function openExpenseModal(
  expense = null
) {

  editingExpenseId =
    expense?.id
    || null;


  setText(
    "expenseModalTitle",
    expense
      ? "Editar gasto"
      : "Nuevo gasto"
  );


  if ($("expenseId")) {
    $("expenseId").value =
      expense?.id
      || "";
  }


  if ($("expenseConcept")) {
    $("expenseConcept").value =
      expense?.concept
      || "";
  }


  if ($("expenseAmount")) {
    $("expenseAmount").value =
      expense?.amount
      ?? "";
  }


  if ($("expenseDate")) {
    $("expenseDate").value =
      expense?.date
      || getToday();
  }


  if ($("expenseType")) {
    $("expenseType").value =
      expense?.type
      || "common";
  }


  if ($("expenseCategory")) {
    $("expenseCategory").value =
      expense?.category
      || "Otros";
  }


  populateMemberSelectors();


  if ($("expenseMember")) {

    $("expenseMember").value =
      expense?.memberId
      || currentUser?.uid
      || "";

  }


  $("expenseModal")
    ?.showModal();

}


async function saveExpense(event) {

  event.preventDefault();


  if (!currentHousehold) {

    toast(
      "No hay un hogar activo.",
      true
    );

    return;

  }


  const concept =
    $("expenseConcept")
      ?.value
      ?.trim();


  const amount =
    Number(
      $("expenseAmount")
        ?.value
    );


  const date =
    $("expenseDate")
      ?.value;


  const type =
    $("expenseType")
      ?.value
      || "common";


  const memberId =
    $("expenseMember")
      ?.value
      || currentUser.uid;


  const category =
    $("expenseCategory")
      ?.value
      || "Otros";


  if (!concept) {

    toast(
      "Introduce un concepto.",
      true
    );

    return;

  }


  if (
    !Number.isFinite(amount)
    || amount <= 0
  ) {

    toast(
      "Introduce un importe válido.",
      true
    );

    return;

  }


  if (!date) {

    toast(
      "Introduce una fecha.",
      true
    );

    return;

  }


  try {

    const data = {

      concept,

      amount,

      date,

      type,

      category,

      memberId,

      updatedAt:
        serverTimestamp()

    };


    const expensesRef =
      collection(
        db,
        "households",
        currentHousehold.id,
        "expenses"
      );


    if (editingExpenseId) {

      await updateDoc(
        doc(
          expensesRef,
          editingExpenseId
        ),
        data
      );


      toast(
        "Gasto actualizado."
      );

    } else {

      await addDoc(
        expensesRef,
        {

          ...data,

          createdBy:
            currentUser.uid,

          createdAt:
            serverTimestamp()

        }
      );


      toast(
        "Gasto guardado."
      );

    }


    editingExpenseId =
      null;


    closeModals();


    await loadExpenses();

    refreshDashboard();

  } catch (error) {

    console.error(error);

    toast(
      getFirebaseErrorMessage(error),
      true
    );

  }

}


function renderExpenses() {

  const tbody =
    $("expensesTable");


  if (!tbody) {
    return;
  }


  const search =
    $("expenseSearch")
      ?.value
      ?.trim()
      .toLowerCase()
      || "";


  const filter =
    $("expenseFilter")
      ?.value
      || "all";


  let data =
    [...expenses];


  if (search) {

    data =
      data.filter(
        expense =>
          String(
            expense.concept || ""
          )
            .toLowerCase()
            .includes(search)
          ||
          String(
            expense.category || ""
          )
            .toLowerCase()
            .includes(search)
      );

  }


  if (filter !== "all") {

    data =
      data.filter(
        expense =>
          expense.type === filter
      );

  }


  if (!data.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          No hay gastos registrados.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    data.map(
      expense => {

        const member =
          getMember(
            expense.memberId
          );


        return `
          <tr>

            <td>
              ${formatDate(
                expense.date
              )}
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  expense.concept
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                expense.category
                || "Otros"
              )}
            </td>

            <td>
              <span class="badge">
                ${
                  expense.type === "common"
                    ? "Común"
                    : "Individual"
                }
              </span>
            </td>

            <td>
              ${escapeHtml(
                member?.name
                || "Usuario"
              )}
            </td>

            <td class="amount">
              ${formatMoney(
                expense.amount
              )}
            </td>

            <td class="actions">

              <button
                type="button"
                title="Editar"
                data-edit-expense="${escapeAttribute(expense.id)}">
                ✏️
              </button>

              <button
                type="button"
                class="delete-button"
                title="Eliminar"
                data-delete-expense="${escapeAttribute(expense.id)}">
                🗑️
              </button>

            </td>

          </tr>
        `;

      }
    ).join("");


  tbody
    .querySelectorAll(
      "[data-edit-expense]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const expense =
              expenses.find(
                item =>
                  item.id ===
                  button.dataset.editExpense
              );


            if (expense) {
              openExpenseModal(
                expense
              );
            }

          }
        );

      }
    );


  tbody
    .querySelectorAll(
      "[data-delete-expense]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            deleteExpense(
              button.dataset
                .deleteExpense
            )
        );

      }
    );

}


async function deleteExpense(id) {

  const expense =
    expenses.find(
      item =>
        item.id === id
    );


  if (!expense) {
    return;
  }


  if (
    !window.confirm(
      `¿Eliminar el gasto "${expense.concept}" de ${formatMoney(expense.amount)}?`
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(
        db,
        "households",
        currentHousehold.id,
        "expenses",
        id
      )
    );


    toast(
      "Gasto eliminado."
    );


    await loadExpenses();

    refreshDashboard();

  } catch (error) {

    console.error(error);

    toast(
      getFirebaseErrorMessage(error),
      true
    );

  }

}


/* =========================================================
   APORTACIONES
========================================================= */

async function loadContributions() {

  if (!currentHousehold) {
    return;
  }


  const ref =
    collection(
      db,
      "households",
      currentHousehold.id,
      "contributions"
    );


  const snapshot =
    await getDocs(ref);


  contributions =
    snapshot.docs
      .map(
        item => ({
          id:
            item.id,

          ...item.data()
        })
      )
      .sort(
        (a, b) =>
          String(
            b.date || ""
          ).localeCompare(
            String(
              a.date || ""
            )
          )
      );


  renderContributions();

}


function openContributionModal() {

  populateMemberSelectors();


  if ($("contributionDate")) {
    $("contributionDate").value =
      getToday();
  }


  if ($("contributionAmount")) {
    $("contributionAmount").value =
      "";
  }


  if ($("contributionConcept")) {
    $("contributionConcept").value =
      "Aportación mensual";
  }


  if ($("contributionMember")) {
    $("contributionMember").value =
      currentUser?.uid
      || "";
  }


  $("contributionModal")
    ?.showModal();

}


async function saveContribution(event) {

  event.preventDefault();


  if (!currentHousehold) {

    toast(
      "No hay un hogar activo.",
      true
    );

    return;

  }


  const memberId =
    $("contributionMember")
      ?.value
      || currentUser.uid;


  const amount =
    Number(
      $("contributionAmount")
        ?.value
    );


  const date =
    $("contributionDate")
      ?.value;


  const concept =
    $("contributionConcept")
      ?.value
      ?.trim()
      || "Aportación";


  if (
    !Number.isFinite(amount)
    || amount <= 0
  ) {

    toast(
      "Introduce un importe válido.",
      true
    );

    return;

  }


  if (!date) {

    toast(
      "Introduce una fecha.",
      true
    );

    return;

  }


  try {

    await addDoc(
      collection(
        db,
        "households",
        currentHousehold.id,
        "contributions"
      ),
      {

        memberId,

        amount,

        date,

        concept,

        createdBy:
          currentUser.uid,

        createdAt:
          serverTimestamp()

      }
    );


    closeModals();


    toast(
      "Aportación guardada."
    );


    await loadContributions();

    refreshDashboard();

  } catch (error) {

    console.error(error);

    toast(
      getFirebaseErrorMessage(error),
      true
    );

  }

}


function renderContributions() {

  const tbody =
    $("contributionsTable");


  if (!tbody) {
    return;
  }


  if (!contributions.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          No hay aportaciones registradas.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    contributions.map(
      contribution => {

        const member =
          getMember(
            contribution.memberId
          );


        return `
          <tr>

            <td>
              ${formatDate(
                contribution.date
              )}
            </td>

            <td>
              ${escapeHtml(
                member?.name
                || "Usuario"
              )}
            </td>

            <td>
              ${escapeHtml(
                contribution.concept
                || "Aportación"
              )}
            </td>

            <td class="amount">
              ${formatMoney(
                contribution.amount
              )}
            </td>

            <td class="actions">

              <button
                type="button"
                class="delete-button"
                title="Eliminar"
                data-delete-contribution="${escapeAttribute(contribution.id)}">
                🗑️
              </button>

            </td>

          </tr>
        `;

      }
    ).join("");


  tbody
    .querySelectorAll(
      "[data-delete-contribution]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            deleteContribution(
              button.dataset
                .deleteContribution
            )
        );

      }
    );

}


async function deleteContribution(id) {

  const contribution =
    contributions.find(
      item =>
        item.id === id
    );


  if (!contribution) {
    return;
  }


  if (
    !window.confirm(
      `¿Eliminar esta aportación de ${formatMoney(contribution.amount)}?`
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(
        db,
        "households",
        currentHousehold.id,
        "contributions",
        id
      )
    );


    toast(
      "Aportación eliminada."
    );


    await loadContributions();

    refreshDashboard();

  } catch (error) {

    console.error(error);

    toast(
      getFirebaseErrorMessage(error),
      true
    );

  }

}


/* =========================================================
   DASHBOARD
========================================================= */

function refreshDashboard() {

  if (!currentHousehold) {
    return;
  }


  const monthExpenses =
    expenses.filter(
      expense =>
        String(
          expense.date || ""
        )
          .startsWith(
            selectedMonth
          )
    );


  const monthContributions =
    contributions.filter(
      contribution =>
        String(
          contribution.date || ""
        )
          .startsWith(
            selectedMonth
          )
    );


  const common =
    sum(
      monthExpenses.filter(
        expense =>
          expense.type === "common"
      )
    );


  const individual =
    sum(
      monthExpenses.filter(
        expense =>
          expense.type === "individual"
      )
    );


  const contributed =
    sum(
      monthContributions
    );


  /*
    Ahorro común:

    aportaciones al hogar
    MENOS
    gastos comunes
  */

  const saving =
    contributed - common;


  setText(
    "dashboardContributions",
    formatMoney(contributed)
  );


  setText(
    "dashboardCommon",
    formatMoney(common)
  );


  setText(
    "dashboardIndividual",
    formatMoney(individual)
  );


  setText(
    "dashboardSaving",
    formatMoney(saving)
  );


  setText(
    "commonBarValue",
    formatMoney(common)
  );


  setText(
    "individualBarValue",
    formatMoney(individual)
  );


  setText(
    "savingBarValue",
    formatMoney(saving)
  );


  setText(
    "currentPeriodLabel",
    formatMonth(
      selectedMonth
    )
  );


  const base =
    Math.max(
      contributed,
      common + individual,
      1
    );


  setWidth(
    "commonBar",
    common / base * 100
  );


  setWidth(
    "individualBar",
    individual / base * 100
  );


  setWidth(
    "savingBar",
    Math.max(
      saving,
      0
    ) / base * 100
  );


  refreshAnnual();

  renderRecentMovements();

}


function refreshAnnual() {

  const year =
    selectedMonth.substring(
      0,
      4
    );


  const yearExpenses =
    expenses.filter(
      expense =>
        String(
          expense.date || ""
        )
          .startsWith(year)
    );


  const yearContributions =
    contributions.filter(
      contribution =>
        String(
          contribution.date || ""
        )
          .startsWith(year)
    );


  const contributed =
    sum(
      yearContributions
    );


  const common =
    sum(
      yearExpenses.filter(
        expense =>
          expense.type === "common"
      )
    );


  const individual =
    sum(
      yearExpenses.filter(
        expense =>
          expense.type === "individual"
      )
    );


  const saving =
    contributed - common;


  setText(
    "annualYear",
    year
  );


  setText(
    "annualContributions",
    formatMoney(contributed)
  );


  setText(
    "annualCommon",
    formatMoney(common)
  );


  setText(
    "annualIndividual",
    formatMoney(individual)
  );


  setText(
    "annualSaving",
    formatMoney(saving)
  );

}


function renderRecentMovements() {

  const container =
    $("recentMovements");


  if (!container) {
    return;
  }


  const movements = [

    ...expenses.map(
      expense => ({

        ...expense,

        movementType:
          "expense",

        movementDate:
          expense.date

      })
    ),

    ...contributions.map(
      contribution => ({

        ...contribution,

        movementType:
          "contribution",

        movementDate:
          contribution.date

      })
    )

  ]
    .sort(
      (a, b) =>
        String(
          b.movementDate || ""
        ).localeCompare(
          String(
            a.movementDate || ""
          )
        )
    )
    .slice(
      0,
      8
    );


  if (!movements.length) {

    container.innerHTML = `
      <div class="empty">
        Todavía no hay movimientos.
      </div>
    `;

    return;

  }


  container.innerHTML =
    movements.map(
      item => {

        const isContribution =
          item.movementType ===
          "contribution";


        return `
          <div class="movement">

            <div>

              <strong>
                ${escapeHtml(
                  item.concept
                  || "Movimiento"
                )}
              </strong>

              <small>
                ${formatDate(
                  item.movementDate
                )}
                ·
                ${
                  isContribution
                    ? "Aportación"
                    : (
                      item.type === "common"
                        ? "Gasto común"
                        : "Gasto individual"
                    )
                }
              </small>

            </div>

            <span class="badge">
              ${
                isContribution
                  ? "Entrada"
                  : "Salida"
              }
            </span>

            <strong>
              ${
                isContribution
                  ? "+"
                  : "-"
              }
              ${formatMoney(
                item.amount
              )}
            </strong>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   MIEMBROS
========================================================= */

function renderMembers() {

  const container =
    $("membersList");


  if (!container) {
    return;
  }


  if (!currentMembers.length) {

    container.innerHTML =
      "<p>No hay miembros.</p>";

    return;

  }


  container.innerHTML =
    currentMembers.map(
      member => {

        const initial =
          String(
            member.name
            || "U"
          )
            .charAt(0)
            .toUpperCase();


        return `
          <div class="member">

            <div class="member-avatar">

              ${
                member.photo
                  ? `
                    <img
                      src="${escapeAttribute(member.photo)}"
                      alt="">
                  `
                  : initial
              }

            </div>

            <div class="member-info">

              <strong>
                ${escapeHtml(
                  member.name
                  || "Usuario"
                )}
              </strong>

              <small>
                ${escapeHtml(
                  member.email
                  || ""
                )}
              </small>

            </div>

            <span class="badge">
              ${
                member.role === "owner"
                  ? "Administrador"
                  : "Miembro"
              }
            </span>

          </div>
        `;

      }
    ).join("");

}


function populateMemberSelectors() {

  const selectors = [

    $("expenseMember"),

    $("contributionMember")

  ];


  selectors.forEach(
    select => {

      if (!select) {
        return;
      }


      const oldValue =
        select.value;


      select.innerHTML =
        currentMembers.map(
          member => `
            <option
              value="${escapeAttribute(member.uid)}">
              ${escapeHtml(
                member.name
                || "Usuario"
              )}
            </option>
          `
        ).join("");


      if (
        currentMembers.some(
          member =>
            member.uid ===
            oldValue
        )
      ) {

        select.value =
          oldValue;

      } else if (
        currentUser
      ) {

        select.value =
          currentUser.uid;

      }

    }
  );

}


function getMember(uid) {

  return currentMembers.find(
    member =>
      member.uid === uid
  );

}


/* =========================================================
   NAVEGACIÓN
========================================================= */

function navigate(page) {

  document
    .querySelectorAll(".page")
    .forEach(
      section =>
        section.classList.add(
          "hidden"
        )
    );


  const target =
    $(`${page}Page`);


  if (target) {

    target.classList.remove(
      "hidden"
    );

  }


  document
    .querySelectorAll(
      ".menu-item[data-page]"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          page
        );

      }
    );


  const titles = {

    dashboard:
      "Dashboard",

    expenses:
      "Gastos",

    contributions:
      "Aportaciones",

    household:
      "Mi hogar",

    settings:
      "Configuración"

  };


  setText(
    "pageTitle",
    titles[page]
    || "Dashboard"
  );


  $("sidebar")
    ?.classList.remove(
      "open"
    );


  if (
    page === "household"
    && currentHousehold
  ) {

    loadHousehold();

  }

}


/* =========================================================
   MODALES
========================================================= */

function closeModals() {

  document
    .querySelectorAll("dialog")
    .forEach(
      dialog => {

        if (dialog.open) {
          dialog.close();
        }

      }
    );

}


/* =========================================================
   TEMAS
========================================================= */

function setTheme(theme) {

  const themes = [

    "classic",
    "modern",
    "clean",
    "dark"

  ];


  if (
    !themes.includes(theme)
  ) {

    theme =
      "classic";

  }


  document.documentElement
    .dataset.theme =
      theme;


  localStorage.setItem(
    "finanzas-theme",
    theme
  );


  document
    .querySelectorAll(
      ".theme-option"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.theme ===
          theme
        );

      }
    );

}


/* =========================================================
   PANTALLAS
========================================================= */

function showLoading() {

  $("loadingScreen")
    ?.classList.remove(
      "hidden"
    );


  $("loginScreen")
    ?.classList.add(
      "hidden"
    );


  $("app")
    ?.classList.add(
      "hidden"
    );

}


function showLogin() {

  $("loadingScreen")
    ?.classList.add(
      "hidden"
    );


  $("loginScreen")
    ?.classList.remove(
      "hidden"
    );


  $("app")
    ?.classList.add(
      "hidden"
    );

}


function showApp() {

  $("loadingScreen")
    ?.classList.add(
      "hidden"
    );


  $("loginScreen")
    ?.classList.add(
      "hidden"
    );


  $("app")
    ?.classList.remove(
      "hidden"
    );


  navigate(
    "dashboard"
  );

}


/* =========================================================
   USUARIO EN PANTALLA
========================================================= */

function updateUserInterface() {

  if (!currentUser) {
    return;
  }


  const name =
    currentUser.displayName
    || "Usuario";


  const email =
    currentUser.email
    || "";


  const photo =
    currentUser.photoURL
    || "";


  setText(
    "userName",
    name
  );


  setText(
    "userEmail",
    email
  );


  setText(
    "settingsName",
    name
  );


  setText(
    "settingsEmail",
    email
  );


  const initial =
    name
      .charAt(0)
      .toUpperCase();


  setText(
    "userInitial",
    initial
  );


  setText(
    "settingsInitial",
    initial
  );


  if (
    $("userPhoto")
  ) {

    $("userPhoto").src =
      photo;

    $("userPhoto").style.display =
      photo
        ? "block"
        : "none";

  }


  if (
    $("settingsPhoto")
  ) {

    $("settingsPhoto").src =
      photo;

    $("settingsPhoto").style.display =
      photo
        ? "block"
        : "none";

  }

}


/* =========================================================
   CARGA COMPLETA
========================================================= */

async function refreshAll() {

  await Promise.all([

    loadExpenses(),

    loadContributions()

  ]);


  refreshDashboard();

}


/* =========================================================
   UTILIDADES
========================================================= */

function getToday() {

  const date =
    new Date();


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    )
      .padStart(
        2,
        "0"
      );


  const day =
    String(
      date.getDate()
    )
      .padStart(
        2,
        "0"
      );


  return `${year}-${month}-${day}`;

}


function getCurrentMonth() {

  return getToday()
    .substring(
      0,
      7
    );

}


function shiftMonth(
  month,
  amount
) {

  const [
    year,
    monthNumber
  ] =
    month
      .split("-")
      .map(Number);


  const date =
    new Date(
      year,
      monthNumber - 1 + amount,
      1
    );


  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;

}


function formatMonth(value) {

  if (!value) {
    return "";
  }


  const [
    year,
    month
  ] =
    value.split("-");


  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    );


  return date
    .toLocaleDateString(
      "es-ES",
      {

        month:
          "long",

        year:
          "numeric"

      }
    );

}


function formatDate(value) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  return date
    .toLocaleDateString(
      "es-ES"
    );

}


function formatMoney(value) {

  return new Intl.NumberFormat(
    "es-ES",
    {

      style:
        "currency",

      currency:
        "EUR"

    }
  ).format(
    Number(value)
    || 0
  );

}


function sum(items) {

  return items.reduce(
    (
      total,
      item
    ) =>
      total +
      Number(
        item.amount
        || 0
      ),
    0
  );

}


function setWidth(
  id,
  value
) {

  const element =
    $(id);


  if (!element) {
    return;
  }


  const width =
    Math.min(
      Math.max(
        Number(value)
        || 0,
        0
      ),
      100
    );


  element.style.width =
    `${width}%`;

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


function escapeAttribute(value) {

  return escapeHtml(
    value
  );

}


/* =========================================================
   MENSAJES
========================================================= */

function toast(
  message,
  error = false
) {

  const element =
    $("toast");


  if (!element) {
    return;
  }


  element.textContent =
    message;


  element.classList.toggle(
    "error",
    error
  );


  element.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        element.classList.remove(
          "show"
        );

      },
      3500
    );

}


function getFirebaseErrorMessage(
  error
) {

  if (
    error?.code ===
    "permission-denied"
  ) {

    return "Firebase ha rechazado el acceso. Comprueba las reglas de Firestore.";

  }


  if (
    error?.code ===
    "auth/popup-blocked"
  ) {

    return "El navegador ha bloqueado la ventana de Google.";

  }


  if (
    error?.code ===
    "auth/unauthorized-domain"
  ) {

    return "Este dominio no está autorizado en Firebase Authentication.";

  }


  if (
    error?.code ===
    "auth/operation-not-allowed"
  ) {

    return "El acceso mediante Google no está habilitado en Firebase.";

  }


  if (
    error?.code ===
    "failed-precondition"
  ) {

    return "Firebase necesita completar una configuración antes de continuar.";

  }


  return (
    error?.message
    ||
    "Se ha producido un error."
  );

}


/* =========================================================
   SERVICE WORKER
========================================================= */

if (
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register(
          "./sw.js"
        )
        .catch(
          error =>
            console.warn(
              "Service Worker:",
              error
            )
        );

    }
  );

}
