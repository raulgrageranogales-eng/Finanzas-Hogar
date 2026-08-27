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
  orderBy,
  limit,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
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


/* =========================================================
   ELEMENTOS
========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   ARRANQUE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  initialiseUI();

  onAuthStateChanged(auth, async user => {

    currentUser = user;

    if (!user) {

      showLogin();

      return;

    }

    try {

      await initialiseUser(user);

    } catch (error) {

      console.error(error);

      toast(
        "No se ha podido cargar tu cuenta.",
        true
      );

      showLogin();

    }

  });

});


/* =========================================================
   INTERFAZ INICIAL
========================================================= */

function initialiseUI() {

  $("googleLogin")?.addEventListener(
    "click",
    loginWithGoogle
  );

  $("logout")?.addEventListener(
    "click",
    logout
  );

  $("settingsLogout")?.addEventListener(
    "click",
    logout
  );

  $("mobileMenu")?.addEventListener(
    "click",
    () => {
      $("sidebar")?.classList.toggle("open");
    }
  );


  /* navegación */

  document
    .querySelectorAll(".menu-item[data-page]")
    .forEach(button => {

      button.addEventListener("click", () => {

        navigate(button.dataset.page);

      });

    });


  document
    .querySelectorAll("[data-go]")
    .forEach(button => {

      button.addEventListener("click", () => {

        navigate(button.dataset.go);

      });

    });


  /* meses */

  $("monthSelector")?.addEventListener(
    "change",
    event => {

      selectedMonth = event.target.value;

      refreshDashboard();

    }
  );


  $("previousMonth")?.addEventListener(
    "click",
    () => {

      selectedMonth =
        shiftMonth(selectedMonth, -1);

      $("monthSelector").value =
        selectedMonth;

      refreshDashboard();

    }
  );


  $("nextMonth")?.addEventListener(
    "click",
    () => {

      selectedMonth =
        shiftMonth(selectedMonth, 1);

      $("monthSelector").value =
        selectedMonth;

      refreshDashboard();

    }
  );


  /* gastos */

  $("newExpense")?.addEventListener(
    "click",
    () => openExpenseModal()
  );

  $("expenseForm")?.addEventListener(
    "submit",
    saveExpense
  );


  $("expenseSearch")?.addEventListener(
    "input",
    renderExpenses
  );

  $("expenseFilter")?.addEventListener(
    "change",
    renderExpenses
  );


  /* aportaciones */

  $("newContribution")?.addEventListener(
    "click",
    openContributionModal
  );

  $("contributionForm")?.addEventListener(
    "submit",
    saveContribution
  );


  /* hogar */

  $("generateInvite")?.addEventListener(
    "click",
    generateInvite
  );

  $("joinHousehold")?.addEventListener(
    "click",
    joinHousehold
  );


  /* temas */

  $("themeButton")?.addEventListener(
    "click",
    () => navigate("settings")
  );

  document
    .querySelectorAll(".theme-option")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          setTheme(
            button.dataset.theme
          );

        }
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


  const savedTheme =
    localStorage.getItem("finanzas-theme")
    || "classic";

  setTheme(savedTheme);

  $("monthSelector").value =
    selectedMonth;

  $("annualYear").textContent =
    new Date().getFullYear();

}


/* =========================================================
   LOGIN
========================================================= */

async function loginWithGoogle() {

  try {

    $("googleLogin").disabled = true;

    await signInWithPopup(
      auth,
      provider
    );

  } catch (error) {

    console.error(error);

    if (
      error.code !==
      "auth/popup-closed-by-user"
    ) {

      toast(
        "No se ha podido iniciar sesión.",
        true
      );

    }

  } finally {

    $("googleLogin").disabled = false;

  }

}


async function logout() {

  try {

    await signOut(auth);

    currentUser = null;
    currentHousehold = null;
    currentMembers = [];

    expenses = [];
    contributions = [];

    showLogin();

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

  showLoading();

  const userRef =
    doc(db, "users", user.uid);

  const userSnap =
    await getDoc(userRef);

  if (!userSnap.exists()) {

    await setDoc(userRef, {

      uid: user.uid,

      name:
        user.displayName
        || "Usuario",

      email:
        user.email
        || "",

      photo:
        user.photoURL
        || "",

      createdAt:
        serverTimestamp()

    });

  } else {

    await setDoc(
      userRef,
      {

        name:
          user.displayName
          || "Usuario",

        email:
          user.email
          || "",

        photo:
          user.photoURL
          || ""

      },
      {
        merge: true
      }
    );

  }


  /* Buscar hogares del usuario */

  const householdsQuery = query(
    collection(db, "households"),
    where(
      "memberIds",
      "array-contains",
      user.uid
    ),
    limit(1)
  );

  const householdSnapshot =
    await getDocs(
      householdsQuery
    );


  if (!householdSnapshot.empty) {

    currentHousehold =
      householdSnapshot.docs[0];

  } else {

    /*
      No tiene hogar todavía.
      Se crea automáticamente.
    */

    currentHousehold =
      await createHousehold(user);

  }


  await loadHousehold();

  showApp();

  await refreshAll();

}


async function createHousehold(user) {

  const householdRef =
    doc(
      collection(db, "households")
    );

  const memberRef =
    doc(
      db,
      "households",
      householdRef.id,
      "members",
      user.uid
    );

  const inviteCode =
    await createUniqueInviteCode();


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


  return householdRef;

}


/* =========================================================
   HOGAR
========================================================= */

async function loadHousehold() {

  if (!currentHousehold) {
    return;
  }

  const householdSnap =
    await getDoc(currentHousehold.ref);

  if (!householdSnap.exists()) {
    throw new Error(
      "El hogar no existe."
    );
  }

  currentHousehold =
    householdSnap;


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
        id: item.id,
        ...item.data()
      })
    );


  renderMembers();

  populateMemberSelectors();

  $("inviteCode").textContent =
    currentHousehold.data().inviteCode
    || "—";

}


async function generateInvite() {

  if (!currentHousehold) {
    return;
  }

  try {

    const code =
      await createUniqueInviteCode();

    const oldCode =
      currentHousehold.data().inviteCode;


    await updateDoc(
      currentHousehold.ref,
      {
        inviteCode: code
      }
    );


    if (oldCode) {

      try {

        await deleteDoc(
          doc(
            db,
            "joinCodes",
            oldCode
          )
        );

      } catch (_) {}

    }


    await setDoc(
      doc(
        db,
        "joinCodes",
        code
      ),
      {
        householdId:
          currentHousehold.id,

        createdAt:
          serverTimestamp()
      }
    );


    $("inviteCode").textContent =
      code;

    toast(
      "Nuevo código generado."
    );

  } catch (error) {

    console.error(error);

    toast(
      "No se ha podido generar el código.",
      true
    );

  }

}


async function joinHousehold() {

  const input =
    $("joinCode");

  const code =
    input.value
      .trim()
      .toUpperCase();


  if (!code) {

    toast(
      "Introduce un código.",
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

    const joinRef =
      doc(
        db,
        "joinCodes",
        code
      );

    const joinSnap =
      await getDoc(joinRef);


    if (!joinSnap.exists()) {

      toast(
        "El código no es válido.",
        true
      );

      return;

    }


    const householdId =
      joinSnap.data().householdId;


    const householdRef =
      doc(
        db,
        "households",
        householdId
      );


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

        joinedAt:
          serverTimestamp()

      }
    );


    const householdSnap =
      await getDoc(householdRef);


    const memberIds =
      householdSnap.data().memberIds
      || [];


    if (!memberIds.includes(currentUser.uid)) {

      await updateDoc(
        householdRef,
        {
          memberIds:
            [...memberIds, currentUser.uid]
        }
      );

    }


    currentHousehold =
      householdSnap;


    input.value = "";

    await loadHousehold();

    await refreshAll();

    toast(
      "Te has unido al hogar correctamente."
    );

  } catch (error) {

    console.error(error);

    toast(
      "No se ha podido unir al hogar.",
      true
    );

  }

}


async function createUniqueInviteCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


  for (let attempt = 0; attempt < 10; attempt++) {

    let code = "";

    for (let i = 0; i < 6; i++) {

      code +=
        characters[
          Math.floor(
            Math.random()
            * characters.length
          )
        ];

    }


    const ref =
      doc(
        db,
        "joinCodes",
        code
      );

    const snap =
      await getDoc(ref);


    if (!snap.exists()) {

      return code;

    }

  }

  throw new Error(
    "No se pudo generar un código único."
  );

}


/* =========================================================
   GASTOS
========================================================= */

async function loadExpenses() {

  if (!currentHousehold) {
    return;
  }


  const ref =
    collection(
      db,
      "households",
      currentHousehold.id,
      "expenses"
    );


  const snapshot =
    await getDocs(
      query(
        ref,
        orderBy(
          "date",
          "desc"
        )
      )
    );


  expenses =
    snapshot.docs.map(
      item => ({
        id:
          item.id,

        ...item.data()
      })
    );


  renderExpenses();

}


async function saveExpense(event) {

  event.preventDefault();


  if (!currentHousehold) {
    return;
  }


  const concept =
    $("expenseConcept")
      .value
      .trim();

  const amount =
    Number(
      $("expenseAmount").value
    );

  const date =
    $("expenseDate").value;

  const type =
    $("expenseType").value;

  const memberId =
    $("expenseMember").value;

  const category =
    $("expenseCategory").value;


  if (!concept) {

    toast(
      "Introduce un concepto.",
      true
    );

    return;

  }


  if (!amount || amount <= 0) {

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


    closeModals();

    editingExpenseId = null;

    await loadExpenses();

    refreshDashboard();

  } catch (error) {

    console.error(error);

    toast(
      "No se ha podido guardar el gasto.",
      true
    );

  }

}


function openExpenseModal(expense = null) {

  const modal =
    $("expenseModal");


  editingExpenseId =
    expense
      ? expense.id
      : null;


  $("expenseModalTitle").textContent =
    expense
      ? "Editar gasto"
      : "Nuevo gasto";


  $("expenseId").value =
    expense?.id || "";


  $("expenseConcept").value =
    expense?.concept || "";


  $("expenseAmount").value =
    expense?.amount ?? "";


  $("expenseDate").value =
    expense?.date
    || getToday();


  $("expenseType").value =
    expense?.type
    || "common";


  $("expenseCategory").value =
    expense?.category
    || "Otros";


  populateMemberSelectors();


  $("expenseMember").value =
    expense?.memberId
    || currentUser.uid;


  modal.showModal();

}


async function deleteExpense(id) {

  const expense =
    expenses.find(
      item => item.id === id
    );


  if (!expense) {
    return;
  }


  const confirmed =
    confirm(
      `¿Eliminar el gasto "${expense.concept}" de ${formatMoney(expense.amount)}?`
    );


  if (!confirmed) {
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
      "No se ha podido eliminar el gasto.",
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
    (
      $("expenseSearch")?.value
      || ""
    )
      .trim()
      .toLowerCase();


  const filter =
    $("expenseFilter")?.value
    || "all";


  let data =
    [...expenses];


  if (search) {

    data =
      data.filter(item =>
        String(
          item.concept || ""
        )
          .toLowerCase()
          .includes(search)
        ||
        String(
          item.category || ""
        )
          .toLowerCase()
          .includes(search)
      );

  }


  if (filter !== "all") {

    data =
      data.filter(
        item =>
          item.type === filter
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
    data.map(expense => {

      const member =
        getMember(expense.memberId);


      return `
        <tr>

          <td>
            ${formatDate(expense.date)}
          </td>

          <td>
            <strong>
              ${escapeHtml(expense.concept)}
            </strong>
          </td>

          <td>
            ${escapeHtml(expense.category || "Otros")}
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
              member?.name || "Usuario"
            )}
          </td>

          <td class="amount">
            ${formatMoney(expense.amount)}
          </td>

          <td class="actions">

            <button
              title="Editar"
              data-edit-expense="${expense.id}">
              ✏️
            </button>

            <button
              class="delete-button"
              title="Eliminar"
              data-delete-expense="${expense.id}">
              🗑️
            </button>

          </td>

        </tr>
      `;

    }).join("");


  tbody
    .querySelectorAll(
      "[data-edit-expense]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const expense =
            expenses.find(
              item =>
                item.id ===
                button.dataset.editExpense
            );

          openExpenseModal(expense);

        }
      );

    });


  tbody
    .querySelectorAll(
      "[data-delete-expense]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteExpense(
            button.dataset.deleteExpense
          )
      );

    });

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
    await getDocs(
      query(
        ref,
        orderBy(
          "date",
          "desc"
        )
      )
    );


  contributions =
    snapshot.docs.map(
      item => ({
        id:
          item.id,

        ...item.data()
      })
    );


  renderContributions();

}


function openContributionModal() {

  populateMemberSelectors();

  $("contributionDate").value =
    getToday();

  $("contributionAmount").value =
    "";

  $("contributionConcept").value =
    "Aportación mensual";

  $("contributionMember").value =
    currentUser.uid;


  $("contributionModal")
    .showModal();

}


async function saveContribution(event) {

  event.preventDefault();


  const memberId =
    $("contributionMember").value;

  const amount =
    Number(
      $("contributionAmount").value
    );

  const date =
    $("contributionDate").value;

  const concept =
    $("contributionConcept")
      .value
      .trim();


  if (!amount || amount <= 0) {

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

        concept:
          concept || "Aportación",

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
      "No se ha podido guardar la aportación.",
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
    contributions.map(item => {

      const member =
        getMember(item.memberId);


      return `
        <tr>

          <td>
            ${formatDate(item.date)}
          </td>

          <td>
            ${escapeHtml(
              member?.name || "Usuario"
            )}
          </td>

          <td>
            ${escapeHtml(
              item.concept || "Aportación"
            )}
          </td>

          <td class="amount">
            ${formatMoney(item.amount)}
          </td>

          <td class="actions">

            <button
              class="delete-button"
              data-delete-contribution="${item.id}"
              title="Eliminar">
              🗑️
            </button>

          </td>

        </tr>
      `;

    }).join("");


  tbody
    .querySelectorAll(
      "[data-delete-contribution]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteContribution(
            button.dataset.deleteContribution
          )
      );

    });

}


async function deleteContribution(id) {

  const contribution =
    contributions.find(
      item => item.id === id
    );


  if (!contribution) {
    return;
  }


  if (
    !confirm(
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
      "No se ha podido eliminar.",
      true
    );

  }

}


/* =========================================================
   DASHBOARD
========================================================= */

async function refreshAll() {

  await Promise.all([
    loadExpenses(),
    loadContributions()
  ]);

  refreshDashboard();

}


function refreshDashboard() {

  if (!currentHousehold) {
    return;
  }


  const month =
    selectedMonth;


  const monthExpenses =
    expenses.filter(
      item =>
        String(item.date || "")
          .startsWith(month)
    );


  const monthContributions =
    contributions.filter(
      item =>
        String(item.date || "")
          .startsWith(month)
    );


  const common =
    sum(
      monthExpenses.filter(
        item =>
          item.type === "common"
      )
    );


  const individual =
    sum(
      monthExpenses.filter(
        item =>
          item.type === "individual"
      )
    );


  const contributed =
    sum(
      monthContributions
    );


  const saving =
    contributed - common;


  $("dashboardContributions")
    .textContent =
      formatMoney(contributed);


  $("dashboardCommon")
    .textContent =
      formatMoney(common);


  $("dashboardIndividual")
    .textContent =
      formatMoney(individual);


  $("dashboardSaving")
    .textContent =
      formatMoney(saving);


  $("commonBarValue")
    .textContent =
      formatMoney(common);


  $("individualBarValue")
    .textContent =
      formatMoney(individual);


  $("savingBarValue")
    .textContent =
      formatMoney(saving);


  const totalBase =
    Math.max(
      contributed,
      common + individual + Math.max(saving, 0),
      1
    );


  setWidth(
    "commonBar",
    common / totalBase * 100
  );


  setWidth(
    "individualBar",
    individual / totalBase * 100
  );


  setWidth(
    "savingBar",
    Math.max(
      saving,
      0
    ) / totalBase * 100
  );


  $("currentPeriodLabel")
    .textContent =
      formatMonth(month);


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
      item =>
        String(item.date || "")
          .startsWith(year)
    );


  const yearContributions =
    contributions.filter(
      item =>
        String(item.date || "")
          .startsWith(year)
    );


  const contributed =
    sum(
      yearContributions
    );


  const common =
    sum(
      yearExpenses.filter(
        item =>
          item.type === "common"
      )
    );


  const individual =
    sum(
      yearExpenses.filter(
        item =>
          item.type === "individual"
      )
    );


  const saving =
    contributed - common;


  $("annualYear")
    .textContent =
      year;


  $("annualContributions")
    .textContent =
      formatMoney(contributed);


  $("annualCommon")
    .textContent =
      formatMoney(common);


  $("annualIndividual")
    .textContent =
      formatMoney(individual);


  $("annualSaving")
    .textContent =
      formatMoney(saving);

}


function renderRecentMovements() {

  const container =
    $("recentMovements");


  if (!container) {
    return;
  }


  const movements = [

    ...expenses.map(item => ({
      ...item,

      movementType:
        "expense",

      movementDate:
        item.date
    })),

    ...contributions.map(item => ({
      ...item,

      movementType:
        "contribution",

      movementDate:
        item.date
    }))

  ]
    .sort(
      (a,b) =>
        String(b.movementDate)
          .localeCompare(
            String(a.movementDate)
          )
    )
    .slice(0, 8);


  if (!movements.length) {

    container.innerHTML = `
      <div class="empty">
        Todavía no hay movimientos.
      </div>
    `;

    return;

  }


  container.innerHTML =
    movements.map(item => {

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
            ${formatMoney(item.amount)}
          </strong>

        </div>
      `;

    }).join("");

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
    currentMembers.map(member => {

      const initial =
        String(
          member.name || "U"
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
                member.name || "Usuario"
              )}
            </strong>

            <small>
              ${escapeHtml(
                member.email || ""
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

    }).join("");

}


function populateMemberSelectors() {

  const selectors = [
    $("expenseMember"),
    $("contributionMember")
  ];


  selectors.forEach(select => {

    if (!select) {
      return;
    }


    const currentValue =
      select.value;


    select.innerHTML =
      currentMembers.map(
        member => `
          <option
            value="${escapeAttribute(member.uid)}">
            ${escapeHtml(
              member.name || "Usuario"
            )}
          </option>
        `
      ).join("");


    if (
      currentMembers.some(
        member =>
          member.uid ===
          currentValue
      )
    ) {

      select.value =
        currentValue;

    }

  });

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
    .forEach(section => {

      section.classList.add(
        "hidden"
      );

    });


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
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


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


  $("pageTitle").textContent =
    titles[page]
    || "Dashboard";


  $("sidebar")
    ?.classList.remove(
      "open"
    );


  if (page === "household") {

    loadHousehold();

  }

  if (page === "expenses") {

    loadExpenses();

  }

  if (page === "contributions") {

    loadContributions();

  }

}


/* =========================================================
   MODALES
========================================================= */

function closeModals() {

  document
    .querySelectorAll("dialog")
    .forEach(dialog => {

      if (dialog.open) {
        dialog.close();
      }

    });

}


/* =========================================================
   TEMA
========================================================= */

function setTheme(theme) {

  const allowed = [
    "classic",
    "modern",
    "clean",
    "dark"
  ];


  if (!allowed.includes(theme)) {

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
    .querySelectorAll(".theme-option")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.theme === theme
      );

    });

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


  $("userName").textContent =
    currentUser.displayName
    || "Usuario";


  $("userEmail").textContent =
    currentUser.email
    || "";


  $("settingsEmail").textContent =
    currentUser.email
    || "";


  if (currentUser.photoURL) {

    $("userPhoto").src =
      currentUser.photoURL;

  }


  navigate("dashboard");

}


/* =========================================================
   UTILIDADES
========================================================= */

function getToday() {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");


  return `${year}-${month}-${day}`;

}


function getCurrentMonth() {

  return getToday()
    .substring(0, 7);

}


function shiftMonth(
  month,
  amount
) {

  const [year, m] =
    month
      .split("-")
      .map(Number);


  const date =
    new Date(
      year,
      m - 1 + amount,
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


  const [year, month] =
    value.split("-");


  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    );


  return date.toLocaleDateString(
    "es-ES",
    {
      month: "long",
      year: "numeric"
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


  return date.toLocaleDateString(
    "es-ES"
  );

}


function formatMoney(value) {

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


function sum(items) {

  return items.reduce(
    (total, item) =>
      total +
      Number(item.amount || 0),
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


  element.style.width =
    `${Math.min(
      Math.max(value, 0),
      100
    )}%`;

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

  return escapeHtml(value);

}


let toastTimer = null;

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


  element.style.background =
    error
      ? "#b91c1c"
      : "#17202a";


  element.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () =>
        element.classList.remove(
          "show"
        ),
      3000
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
        .register("./sw.js")
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
