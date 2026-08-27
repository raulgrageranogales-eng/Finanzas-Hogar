import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =====================================================
   FIREBASE
===================================================== */

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

const provider = new GoogleAuthProvider();


/* =====================================================
   ESTADO
===================================================== */

let user = null;

let homeId = null;

let home = null;

let shared = [];

let privateMovements = [];

let goals = [];

let recurring = [];

let accounts = [];

let members = [];

let invitations = [];

let sharedType = "expense";

let privateType = "expense";

let recurringType = "expense";


/* =====================================================
   UTILIDADES
===================================================== */

const $ = id => document.getElementById(id);

const today = () =>
  new Date().toISOString().slice(0,10);


const eur = number =>
  new Intl.NumberFormat(
    "es-ES",
    {
      style:"currency",
      currency:"EUR"
    }
  ).format(Number(number) || 0);


const esc = value =>
  String(value ?? "")
    .replace(/[&<>"']/g, char => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[char]));


function toast(message){

  const element = $("toast");

  element.textContent = message;

  element.classList.add("show");

  setTimeout(
    () => element.classList.remove("show"),
    2500
  );

}


function monthName(index){

  return [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic"
  ][index];

}


function totals(list){

  return list.reduce(
    (result,item) => {

      const amount = Number(item.amount) || 0;

      if(item.type === "income"){
        result.income += amount;
      }else{
        result.expenses += amount;
      }

      return result;

    },
    {
      income:0,
      expenses:0
    }
  );

}


/*
  En movimientos comunes:
  income = aportación al fondo común
  expense = gasto común
*/

function sharedTotals(list){

  return list.reduce(
    (result,item) => {

      const amount = Number(item.amount) || 0;

      if(item.type === "income"){
        result.contributions += amount;
      }else{
        result.expenses += amount;
      }

      return result;

    },
    {
      contributions:0,
      expenses:0
    }
  );

}


/* =====================================================
   NAVEGACIÓN
===================================================== */

function showSection(section){

  document
    .querySelectorAll("main")
    .forEach(
      main => main.classList.add("hidden")
    );

  const target = $(`${section}-screen`);

  if(target){
    target.classList.remove("hidden");
  }

  window.scrollTo(0,0);

}


/* =====================================================
   CARGAR COLECCIONES
===================================================== */

async function getAll(path){

  const snapshot =
    await getDocs(
      collection(db,...path)
    );

  return snapshot.docs.map(
    item => ({
      id:item.id,
      ...item.data()
    })
  );

}


/* =====================================================
   CARGAR DATOS
===================================================== */

async function loadData(){

  if(!user){
    return;
  }


  const userDocument =
    await getDoc(
      doc(db,"users",user.uid)
    );


  homeId =
    userDocument.exists()
      ? userDocument.data().homeId
      : null;


  if(!homeId){

    $("create-home-screen")
      .classList.remove("hidden");

    $("home-screen")
      .classList.add("hidden");

    return;

  }


  const homeDocument =
    await getDoc(
      doc(db,"homes",homeId)
    );


  home =
    homeDocument.exists()
      ? {
          id:homeDocument.id,
          ...homeDocument.data()
        }
      : null;


  shared =
    await getAll([
      "homes",
      homeId,
      "movements"
    ]);


  goals =
    await getAll([
      "homes",
      homeId,
      "goals"
    ]);


  recurring =
    await getAll([
      "homes",
      homeId,
      "recurring"
    ]);


  members =
    await getAll([
      "homes",
      homeId,
      "members"
    ]);


  invitations =
    await getAll([
      "homes",
      homeId,
      "invitations"
    ]);


  privateMovements =
    await getAll([
      "users",
      user.uid,
      "privateMovements"
    ]);


  accounts =
    await getAll([
      "users",
      user.uid,
      "accounts"
    ]);


  $("create-home-screen")
    .classList.add("hidden");

  $("home-screen")
    .classList.remove("hidden");


  renderAll();

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard(){

  const now = new Date();

  const year = now.getFullYear();

  const month =
    String(
      now.getMonth()+1
    ).padStart(2,"0");


  const currentPrefix =
    `${year}-${month}`;


  const commonMonth =
    shared.filter(
      item =>
        String(item.date || "")
          .startsWith(currentPrefix)
    );


  const privateMonth =
    privateMovements.filter(
      item =>
        String(item.date || "")
          .startsWith(currentPrefix)
    );


  const common =
    sharedTotals(commonMonth);

  const individual =
    totals(privateMonth);


  const commonSaving =
    common.contributions -
    common.expenses;


  const totalExpenses =
    common.expenses +
    individual.expenses;


  const totalSaving =
    commonSaving +
    individual.income -
    individual.expenses;


  const allCommon =
    sharedTotals(shared);


  $("home-title").textContent =
    home?.name || "Finanzas Hogar";


  $("dashboard-year").textContent =
    year;


  $("dashboard-contributions").textContent =
    eur(common.contributions);


  $("dashboard-common-expenses").textContent =
    eur(common.expenses);


  $("dashboard-individual-expenses").textContent =
    eur(individual.expenses);


  $("dashboard-common-saving").textContent =
    eur(commonSaving);


  $("home-income-month").textContent =
    eur(common.contributions);


  $("home-total-expenses").textContent =
    eur(totalExpenses);


  $("home-my-private-expenses").textContent =
    eur(individual.expenses);


  $("home-total-saving").textContent =
    eur(totalSaving);


  renderAnnual(year);

}


/* =====================================================
   ANUAL
===================================================== */

function renderAnnual(year){

  let cumulative = 0;

  let annualSaving = 0;

  let rows = "";

  let bars = "";


  const annualData = [];


  for(let month=0;month<12;month++){

    const prefix =
      `${year}-${String(month+1).padStart(2,"0")}`;


    const common =
      sharedTotals(
        shared.filter(
          item =>
            String(item.date || "")
              .startsWith(prefix)
        )
      );


    const individual =
      totals(
        privateMovements.filter(
          item =>
            String(item.date || "")
              .startsWith(prefix)
        )
      );


    const saving =
      common.contributions -
      common.expenses;


    cumulative += saving;

    annualSaving += saving;


    annualData.push({
      month:monthName(month),
      contributions:common.contributions,
      commonExpenses:common.expenses,
      individualExpenses:individual.expenses,
      saving,
      cumulative
    });

  }


  const maximum =
    Math.max(
      1,
      ...annualData.map(
        item => Math.abs(item.saving)
      )
    );


  annualData.forEach(item => {

    rows += `
      <tr>

        <td>${item.month}</td>

        <td>
          ${eur(item.contributions)}
        </td>

        <td class="negative">
          ${eur(item.commonExpenses)}
        </td>

        <td class="negative">
          ${eur(item.individualExpenses)}
        </td>

        <td class="${item.saving >= 0 ? "positive" : "negative"}">
          ${eur(item.saving)}
        </td>

        <td class="${item.cumulative >= 0 ? "positive" : "negative"}">
          ${eur(item.cumulative)}
        </td>

      </tr>
    `;


    const height =
      Math.max(
        4,
        Math.min(
          100,
          Math.abs(item.saving) /
          maximum *
          100
        )
      );


    bars += `
      <div class="bar-col">

        <span class="bar-value">
          ${eur(item.saving)}
        </span>

        <div
          class="bar ${item.saving < 0 ? "negative" : ""}"
          style="height:${height}%"
        ></div>

        <span class="bar-label">
          ${item.month}
        </span>

      </div>
    `;

  });


  $("annual-saving-total")
    .textContent = eur(annualSaving);


  $("annual-table-body")
    .innerHTML = rows;


  $("annual-bars")
    .innerHTML = bars;

}


/* =====================================================
   MOVIMIENTOS
===================================================== */

function movementHtml(item,privateMode=false){

  const income =
    item.type === "income";


  const sign =
    income ? "+" : "-";


  const cls =
    income ? "positive" : "negative";


  return `
    <div class="movement">

      <div class="movement-info">

        <strong>
          ${esc(item.description || "Sin descripción")}
        </strong>

        <small>
          ${esc(item.category || "otros")}
          ·
          ${esc(item.date || "")}

          ${
            item.ownerName
              ? ` · ${esc(item.ownerName)}`
              : ""
          }

        </small>

      </div>


      <strong class="${cls}">
        ${sign}${eur(item.amount)}
      </strong>


      <button
        class="delete-button"
        data-delete="${privateMode ? "private" : "shared"}"
        data-id="${item.id}"
      >
        🗑️
      </button>

    </div>
  `;

}


function renderShared(){

  $("shared-movements-list").innerHTML =

    shared
      .sort(
        (a,b) =>
          String(b.date)
            .localeCompare(String(a.date))
      )
      .map(
        item => movementHtml(item)
      )
      .join("")

    ||

    `<div class="card muted">
      No hay movimientos comunes.
    </div>`;

}


/* =====================================================
   PRIVADO
===================================================== */

function renderPrivate(){

  const total =
    totals(privateMovements);


  $("private-income")
    .textContent =
    eur(total.income);


  $("private-expenses")
    .textContent =
    eur(total.expenses);


  $("private-balance")
    .textContent =
    eur(
      total.income -
      total.expenses
    );


  $("private-movements-list").innerHTML =

    privateMovements
      .sort(
        (a,b) =>
          String(b.date)
            .localeCompare(String(a.date))
      )
      .map(
        item =>
          movementHtml(item,true)
      )
      .join("")

    ||

    `<div class="card muted">
      No hay movimientos privados.
    </div>`;


  $("private-accounts-list").innerHTML =

    accounts
      .map(
        item => `

          <div class="account">

            <div>

              <strong>
                ${esc(item.name)}
              </strong>

              <small>
                ${eur(item.balance)}
              </small>

            </div>


            <button
              class="delete-button"
              data-delete="account"
              data-id="${item.id}"
            >
              🗑️
            </button>

          </div>

        `
      )
      .join("");

}


/* =====================================================
   OBJETIVOS
===================================================== */

function renderGoals(){

  $("goals-list").innerHTML =

    goals
      .map(item => {

        const target =
          Number(item.target) || 1;

        const saved =
          Number(item.saved) || 0;

        const percentage =
          Math.min(
            100,
            saved / target * 100
          );


        return `

          <div class="goal">

            <div style="flex:1">

              <strong>
                ${esc(item.name)}
              </strong>

              <small>
                ${eur(saved)}
                /
                ${eur(target)}
                ·
                ${percentage.toFixed(0)}%
              </small>

              <progress
                max="100"
                value="${percentage}"
                style="width:100%"
              ></progress>

            </div>


            <button
              class="delete-button"
              data-delete="goal"
              data-id="${item.id}"
            >
              🗑️
            </button>

          </div>

        `;

      })
      .join("")

    ||

    `<div class="card muted">
      No hay objetivos.
    </div>`;

}


/* =====================================================
   RECURRENTES
===================================================== */

function renderRecurring(){

  $("recurring-list").innerHTML =

    recurring
      .map(
        item => `

          <div class="recurring">

            <div>

              <strong>
                ${esc(item.name)}
              </strong>

              <small>
                Día ${item.day}
                ·
                ${
                  item.type === "income"
                    ? "Ingreso"
                    : "Gasto"
                }
                ·
                ${eur(item.amount)}
              </small>

            </div>


            <button
              class="delete-button"
              data-delete="recurring"
              data-id="${item.id}"
            >
              🗑️
            </button>

          </div>

        `
      )
      .join("")

    ||

    `<div class="card muted">
      No hay movimientos recurrentes.
    </div>`;

}


/* =====================================================
   MIEMBROS
===================================================== */

function renderMembers(){

  $("members-list").innerHTML =

    members
      .map(
        item => `

          <div class="member">

            <div>

              <strong>
                ${esc(
                  item.name ||
                  item.email ||
                  "Usuario"
                )}
              </strong>

              <small>
                ${esc(item.email || "")}
                ·
                ${esc(item.role || "member")}
              </small>

            </div>

          </div>

        `
      )
      .join("");


  $("pending-invitations").innerHTML =

    invitations
      .filter(
        item =>
          item.status === "pending"
      )
      .map(
        item => `

          <div class="invite">

            <div>

              <strong>
                Invitación pendiente
              </strong>

              <small>
                ${esc(item.email)}
              </small>

            </div>

          </div>

        `
      )
      .join("");

}


/* =====================================================
   REPARTO
===================================================== */

function renderSplit(){

  const year =
    new Date().getFullYear();


  const html =
    members
      .map(member => {

        const memberShared =
          shared.filter(
            item =>
              item.ownerUid === member.uid &&
              String(item.date || "")
                .startsWith(String(year))
          );


        const totalsMember =
          sharedTotals(memberShared);


        return `

          <div class="member">

            <div>

              <strong>
                ${esc(
                  member.name ||
                  member.email ||
                  "Usuario"
                )}
              </strong>

              <small>
                Aportaciones:
                ${eur(totalsMember.contributions)}
                ·
                Gastos:
                ${eur(totalsMember.expenses)}
              </small>

            </div>


            <strong class="saving">
              ${eur(
                totalsMember.contributions -
                totalsMember.expenses
              )}
            </strong>

          </div>

        `;

      })
      .join("");


  $("split-list").innerHTML =
    html ||
    `<div class="card muted">
      Aún no hay datos.
    </div>`;

}


/* =====================================================
   CREAR HOGAR
===================================================== */

async function createHome(){

  const name =
    $("new-home-name")
      .value
      .trim()
      ||
      "Mi hogar";


  const homeDocument =
    doc(
      collection(
        db,
        "homes"
      )
    );


  homeId =
    homeDocument.id;


  await setDoc(
    homeDocument,
    {
      name,
      ownerUid:user.uid,
      createdAt:
        new Date().toISOString()
    }
  );


  await setDoc(
    doc(
      db,
      "homes",
      homeId,
      "members",
      user.uid
    ),
    {
      uid:user.uid,
      email:user.email,
      name:
        user.displayName ||
        user.email,
      role:"owner"
    }
  );


  await setDoc(
    doc(
      db,
      "users",
      user.uid
    ),
    {
      homeId
    },
    {
      merge:true
    }
  );


  toast("Hogar creado");

  await loadData();

}


/* =====================================================
   GUARDAR COMÚN
===================================================== */

async function saveShared(){

  const description =
    $("shared-description")
      .value
      .trim();


  const amount =
    Number(
      $("shared-amount").value
    );


  const date =
    $("shared-date").value;


  if(
    !description ||
    amount <= 0 ||
    !date
  ){

    toast(
      "Completa descripción, importe y fecha"
    );

    return;
  }


  await addDoc(
    collection(
      db,
      "homes",
      homeId,
      "movements"
    ),
    {

      description,

      amount,

      type:sharedType,

      category:
        $("shared-category").value,

      date,

      ownerUid:user.uid,

      ownerName:
        user.displayName ||
        user.email,

      createdAt:
        new Date().toISOString()

    }
  );


  $("shared-description").value = "";

  $("shared-amount").value = "";


  toast("Movimiento guardado");

  await loadData();

}


/* =====================================================
   GUARDAR PRIVADO
===================================================== */

async function savePrivate(){

  const description =
    $("private-description")
      .value
      .trim();


  const amount =
    Number(
      $("private-amount").value
    );


  const date =
    $("private-date").value;


  if(
    !description ||
    amount <= 0 ||
    !date
  ){

    toast(
      "Completa descripción, importe y fecha"
    );

    return;
  }


  await addDoc(
    collection(
      db,
      "users",
      user.uid,
      "privateMovements"
    ),
    {

      description,

      amount,

      type:privateType,

      category:
        $("private-category").value,

      date,

      ownerUid:user.uid,

      ownerName:
        user.displayName ||
        user.email,

      createdAt:
        new Date().toISOString()

    }
  );


  $("private-description").value = "";

  $("private-amount").value = "";


  toast(
    "Movimiento privado guardado"
  );


  await loadData();

}


/* =====================================================
   BORRAR
===================================================== */

async function deleteItem(
  type,
  id
){

  const paths = {

    shared:[
      "homes",
      homeId,
      "movements",
      id
    ],

    private:[
      "users",
      user.uid,
      "privateMovements",
      id
    ],

    account:[
      "users",
      user.uid,
      "accounts",
      id
    ],

    goal:[
      "homes",
      homeId,
      "goals",
      id
    ],

    recurring:[
      "homes",
      homeId,
      "recurring",
      id
    ]

  };


  if(
    !confirm(
      "¿Eliminar este registro?\n\n" +
      "Esta acción no se puede deshacer."
    )
  ){

    return;

  }


  await deleteDoc(
    doc(
      db,
      ...paths[type]
    )
  );


  toast("Registro eliminado");

  await loadData();

}


/* =====================================================
   OBJETIVOS
===================================================== */

async function saveGoal(){

  const name =
    $("goal-name")
      .value
      .trim();


  const target =
    Number(
      $("goal-target").value
    );


  const saved =
    Number(
      $("goal-saved").value
    ) || 0;


  if(
    !name ||
    target <= 0
  ){

    toast(
      "Completa el objetivo"
    );

    return;
  }


  await addDoc(
    collection(
      db,
      "homes",
      homeId,
      "goals"
    ),
    {
      name,
      target,
      saved,
      createdAt:
        new Date().toISOString()
    }
  );


  $("goal-name").value = "";

  $("goal-target").value = "";

  $("goal-saved").value = "";


  toast(
    "Objetivo creado"
  );


  await loadData();

}


/* =====================================================
   RECURRENTES
===================================================== */

async function saveRecurring(){

  const name =
    $("recurring-name")
      .value
      .trim();


  const amount =
    Number(
      $("recurring-amount").value
    );


  const day =
    Number(
      $("recurring-day").value
    );


  if(
    !name ||
    amount <= 0 ||
    day < 1 ||
    day > 31
  ){

    toast(
      "Completa correctamente los datos"
    );

    return;
  }


  await addDoc(
    collection(
      db,
      "homes",
      homeId,
      "recurring"
    ),
    {
      name,
      amount,
      day,
      type:recurringType,
      createdAt:
        new Date().toISOString()
    }
  );


  toast(
    "Recurrente guardado"
  );


  await loadData();

}


/* =====================================================
   CUENTAS
===================================================== */

async function saveAccount(){

  const name =
    $("private-account-name")
      .value
      .trim();


  const balance =
    Number(
      $("private-account-balance").value
    ) || 0;


  if(!name){

    toast(
      "Introduce un nombre"
    );

    return;
  }


  await addDoc(
    collection(
      db,
      "users",
      user.uid,
      "accounts"
    ),
    {
      name,
      balance
    }
  );


  $("private-account-name").value = "";

  $("private-account-balance").value = "";


  toast(
    "Cuenta añadida"
  );


  await loadData();

}


/* =====================================================
   INVITACIONES
===================================================== */

async function invite(){

  const email =
    $("invite-email")
      .value
      .trim()
      .toLowerCase();


  if(!email){

    toast(
      "Introduce un correo"
    );

    return;
  }


  await addDoc(
    collection(
      db,
      "homes",
      homeId,
      "invitations"
    ),
    {
      email,
      status:"pending",
      createdBy:user.uid,
      createdAt:
        new Date().toISOString()
    }
  );


  $("invite-email").value = "";

  $("invite-message").textContent =
    "Invitación creada. La persona debe entrar con ese correo.";


  toast(
    "Invitación creada"
  );


  await loadData();

}


/* =====================================================
   SELECTOR DE TIPO
===================================================== */

function setType(
  group,
  type
){

  if(group === "shared"){
    sharedType = type;
  }

  if(group === "private"){
    privateType = type;
  }

  if(group === "recurring"){
    recurringType = type;
  }


  const ids =
    group === "shared"
      ? [
          "shared-expense-button",
          "shared-income-button"
        ]

      : group === "private"
      ? [
          "private-expense-button",
          "private-income-button"
        ]

      : [
          "recurring-expense-button",
          "recurring-income-button"
        ];


  $(ids[0])
    .classList
    .toggle(
      "active",
      type === "expense"
    );


  $(ids[1])
    .classList
    .toggle(
      "active",
      type === "income"
    );

}


/* =====================================================
   APARIENCIA
===================================================== */

function applyAppearance(){

  const style =
    localStorage.getItem(
      "fh-style"
    )
    ||
    "classic";


  const theme =
    localStorage.getItem(
      "fh-theme"
    )
    ||
    "system";


  const density =
    localStorage.getItem(
      "fh-density"
    )
    ||
    "comfortable";


  document.body.classList.remove(
    "style-classic",
    "style-modern",
    "style-minimal",
    "density-compact"
  );


  document.body.classList.add(
    `style-${style}`
  );


  if(
    density === "compact"
  ){

    document.body.classList.add(
      "density-compact"
    );

  }


  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );

}


/* =====================================================
   EVENTOS
===================================================== */

$("google-login").onclick =
  async () => {

    try{

      await signInWithPopup(
        auth,
        provider
      );

    }catch(error){

      $("login-error")
        .textContent =
        error.message;

    }

  };


$("logout-button").onclick =
  () =>
    signOut(auth);


$("create-home-button").onclick =
  createHome;


$("save-shared-button").onclick =
  saveShared;


$("save-private-movement").onclick =
  savePrivate;


$("save-goal-button").onclick =
  saveGoal;


$("save-recurring-button").onclick =
  saveRecurring;


$("save-private-account").onclick =
  saveAccount;


$("invite-button").onclick =
  invite;


/* TIPOS */

$("shared-expense-button").onclick =
  () =>
    setType(
      "shared",
      "expense"
    );


$("shared-income-button").onclick =
  () =>
    setType(
      "shared",
      "income"
    );


$("private-expense-button").onclick =
  () =>
    setType(
      "private",
      "expense"
    );


$("private-income-button").onclick =
  () =>
    setType(
      "private",
      "income"
    );


$("recurring-expense-button").onclick =
  () =>
    setType(
      "recurring",
      "expense"
    );


$("recurring-income-button").onclick =
  () =>
    setType(
      "recurring",
      "income"
    );


/* NAVEGACIÓN */

document
  .querySelectorAll(
    "[data-section]"
  )
  .forEach(
    button => {

      button.onclick =
        () =>
          showSection(
            button.dataset.section
          );

    }
  );


/* BORRADO */

document.body.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-delete]"
      );


    if(!button){
      return;
    }


    deleteItem(
      button.dataset.delete,
      button.dataset.id
    );

  }
);


/* APARIENCIA */

document
  .querySelectorAll(
    "[data-theme]"
  )
  .forEach(
    button => {

      button.onclick = () => {

        localStorage.setItem(
          "fh-theme",
          button.dataset.theme
        );

        applyAppearance();

      };

    }
  );


document
  .querySelectorAll(
    "[data-style]"
  )
  .forEach(
    button => {

      button.onclick = () => {

        localStorage.setItem(
          "fh-style",
          button.dataset.style
        );

        applyAppearance();

      };

    }
  );


document
  .querySelectorAll(
    "[data-density]"
  )
  .forEach(
    button => {

      button.onclick = () => {

        localStorage.setItem(
          "fh-density",
          button.dataset.density
        );

        applyAppearance();

      };

    }
  );


/* FECHAS */

$("shared-date").value =
  today();

$("private-date").value =
  today();


/* PWA */

if(
  "serviceWorker"
  in navigator
){

  navigator.serviceWorker
    .register(
      "./service-worker.js"
    )
    .catch(
      () => {}
    );

}


/* =====================================================
   AUTENTICACIÓN
===================================================== */

onAuthStateChanged(
  auth,
  async currentUser => {

    user =
      currentUser;


    if(user){

      $("login-screen")
        .classList
        .add("hidden");


      $("app-screen")
        .classList
        .remove("hidden");


      $("user-name")
        .textContent =
        user.displayName ||
        user.email ||
        "Usuario";


      await setDoc(
        doc(
          db,
          "users",
          user.uid
        ),
        {
          email:user.email,
          name:
            user.displayName ||
            user.email
        },
        {
          merge:true
        }
      );


      await loadData();

    }else{

      $("login-screen")
        .classList
        .remove("hidden");


      $("app-screen")
        .classList
        .add("hidden");

    }

  }
);
