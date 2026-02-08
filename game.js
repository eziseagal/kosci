/* =======================
   ZMIENNE GLOBALNE
======================= */
let aktywnyGracz = null;
let aktywnaKomorka = null;
let liczbaGraczy = 2;
let nazwyGraczy = new Array(liczbaGraczy).fill("");

let generałLicznik = [];
let generałWynik = [];
// Stos do cofania akcji
let undoStack = [];

/* =======================
   DEFINICJA PÓL
======================= */
const pola = {
  "Jedynki": gorne(1),
  "Dwójki": gorne(2),
  "Trójki": gorne(3),
  "Czwórki": gorne(4),
  "Piątki": gorne(5),
  "Szóstki": gorne(6),

  "Trzy jednakowe": zakres(0, 30, 1),
  "Cztery jednakowe": zakres(0, 30, 1),
  "Full": [0, 25],
  "Mały strit": [0, 30],
  "Duży strit": [0, 40],
  "Szansa": zakres(0, 30, 1),
  "Generał": [0, 50]
};

const gornePola = [
  "Jedynki",
  "Dwójki",
  "Trójki",
  "Czwórki",
  "Piątki",
  "Szóstki"
];

/* =======================
   START
======================= */
init();
initPlayerCountButtons();

/* =======================
   INICJALIZACJA
======================= */
function initPlayerCountButtons() {
  const container = document.getElementById('liczba-graczy-buttons');
  container.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.innerText = i;
    btn.onclick = () => {
      liczbaGraczy = i;
      etapNazwy();
    };
    container.appendChild(btn);
  }
  
  // Obsługa klawiszy 1-0 do wyboru liczby graczy
  const handleKeyDown = (e) => {
    const key = e.key;
    let selectedNum = null;
    
    if (key >= '1' && key <= '9') {
      selectedNum = parseInt(key);
    } else if (key === '0') {
      selectedNum = 10;
    }
    
    if (selectedNum !== null && document.getElementById('etap-liczba').style.display !== 'none') {
      e.preventDefault();
      liczbaGraczy = selectedNum;
      etapNazwy();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
}

function init() {
  const tabela = document.getElementById("tabela");
  
  // Wyczyść tabelę (zostaw tylko headers)
  while (tabela.rows.length > 1) {
    tabela.deleteRow(1);
  }
  
  // Dodaj nagłówki dla każdego gracza
  const headerRow = tabela.rows[0];
  while (headerRow.cells.length > 1) {
    headerRow.deleteCell(1);
  }
  for (let g = 0; g < liczbaGraczy; g++) {
    headerRow.insertCell().innerText = nazwyGraczy[g] || `Gracz ${g + 1}`;
  }

  for (let pole in pola) {
    const r = tabela.insertRow();
    r.dataset.pole = pole;
    r.insertCell().innerText = pole;

    for (let g = 0; g < liczbaGraczy; g++) {
      const c = r.insertCell();
      c.classList.add("pole-gry");
        c.onmouseover = () => {
        if (!c.classList.contains("zablokowane") && g === aktywnyGracz) {
          wybierzPole(pole, g, c);
        }
      };
      // Utrzymaj fokus na inpucie także przy kliknięciu (kliknięcie nie powinno wyłączać możliwości wpisywania)
      c.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!c.classList.contains("zablokowane") && g === aktywnyGracz) {
          wybierzPole(pole, g, c);
          // Po otwarciu panelu ustaw fokus na polu wpisywania
          setTimeout(() => {
            const input = document.querySelector('.input-liczby input');
            if (input) input.focus();
          }, 0);
        }
      };
      c.onmouseleave = () => {
        if (aktywnaKomorka && aktywnaKomorka.gracz === g && aktywnaKomorka.pole === pole) {
          // Nie ukrywaj jeszcze, czekaj aż myszka opuści panel
        }
      };
    }
    
    // Po Szóstki dodaj Sumę górną i Premię
    if (pole === "Szóstki") {
      // Najpierw premia, potem suma górna (premia będzie wliczona do sumy górnej)
      dodajWiersz("Premia");
      dodajWiersz("Suma górna");
    }
  }

  // PODSUMOWANIA - Reszta
  dodajWiersz("Suma dolna");
  dodajWiersz("RAZEM");
}

function dodajWiersz(nazwa) {
  const tabela = document.getElementById("tabela");
  const r = tabela.insertRow();
  r.dataset.sum = nazwa;
  r.insertCell().innerText = nazwa;
  for (let g = 0; g < liczbaGraczy; g++) {
    r.insertCell();
  }
}

/* =======================
   ETAPY STARTU
======================= */
function etapNazwy() {
  // liczbaGraczy jest już ustawiona z kliknięcia przycisku
  
  document.getElementById("etap-liczba").style.display = "none";
  document.getElementById("etap-nazwy").style.display = "block";
  
  const inputsDiv = document.getElementById("nazwa-inputs");
  inputsDiv.innerHTML = "";
  
  nazwyGraczy = new Array(liczbaGraczy).fill("");
  
  for (let g = 0; g < liczbaGraczy; g++) {
    const label = document.createElement("label");
    label.innerText = `Gracz ${g + 1}: `;
    const input = document.createElement("input");
    input.type = "text";
    input.value = `Gracz ${g + 1}`;
    input.onchange = (e) => { nazwyGraczy[g] = e.target.value || `Gracz ${g + 1}`; };
    input.onblur = (e) => { nazwyGraczy[g] = e.target.value || `Gracz ${g + 1}`; };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nazwyGraczy[g] = input.value || `Gracz ${g + 1}`;
        // Jeśli to ostatni gracz, przejdź do następnego kroku, inaczej przejdź do następnego inputu
        if (g === liczbaGraczy - 1) {
          etapStartowania();
        } else {
          const nextInput = inputsDiv.querySelectorAll('input')[g + 1];
          if (nextInput) nextInput.focus();
        }
      }
    };
    
    const div = document.createElement("div");
    div.className = "nazwa-input";
    div.appendChild(label);
    div.appendChild(input);
    inputsDiv.appendChild(div);
  }
  
  // Ustaw fokus na pierwszym inputie
  setTimeout(() => {
    const firstInput = inputsDiv.querySelector('input');
    if (firstInput) firstInput.focus();
  }, 0);
}

function etapStartowania() {
  document.getElementById("etap-nazwy").style.display = "none";
  document.getElementById("etap-start").style.display = "block";
  
  const startDiv = document.getElementById("gracz-startowy");
  startDiv.innerHTML = "";
  
  for (let g = 0; g < liczbaGraczy; g++) {
    const btn = document.createElement("button");
    btn.innerText = nazwyGraczy[g] || `Gracz ${g + 1}`;
    btn.onclick = () => { aktywnyGracz = g; startGry(); };
    startDiv.appendChild(btn);
  }
}

/* =======================
   START GRY
======================= */
function startGry() {
  // Zresetuj tablice generałów
  generałLicznik = new Array(liczbaGraczy).fill(0);
  generałWynik = new Array(liczbaGraczy).fill(0);
  
  // Jeśli nie wybrano aktywnego gracza (np. kliknięto "Rozpocznij grę" bez wyboru), losuj startującego
  if (aktywnyGracz === null || typeof aktywnyGracz !== 'number') {
    aktywnyGracz = Math.floor(Math.random() * liczbaGraczy);
  }

  document.getElementById("start").style.display = "none";
  
  // Pokaż elementy gry
  document.getElementById("tura").classList.add("aktywna");
  document.querySelector(".layout").classList.add("aktywna");
  document.getElementById("controls").classList.add("aktywna");
  
  init();
  aktualizujTure();
  // Re-bind buttons in case DOM changed
  bindControlButtons();
}

/* =======================
   TURA
======================= */
function aktualizujTure() {
  document.getElementById("tura").innerText =
    `Tura: ${nazwyGraczy[aktywnyGracz]}`;

  document.querySelectorAll("td").forEach(td => {
    td.classList.remove("aktywny-gracz");
  });

  document.querySelectorAll("#tabela tr").forEach(tr => {
    const td = tr.cells[aktywnyGracz + 1];
    if (td && !td.classList.contains("zablokowane")) {
      td.classList.add("aktywny-gracz");
    }
  });
}

/* =======================
   WYBÓR POLA
======================= */
function wybierzPole(pole, gracz, komorka) {
  if (gracz !== aktywnyGracz) return;
  if (komorka.classList.contains("zablokowane")) return;

  aktywnaKomorka = { pole, gracz, komorka };

  const panel = document.getElementById("panel");
  panel.classList.add("aktywny");
  document.getElementById("opis").innerText =
    `${pole} – ${nazwyGraczy[gracz] || `Gracz ${gracz + 1}`}`;

  renderOpcje(pole);
  
  // Po wyrenderowaniu opcji ustaw fokus i wypozycjonuj panel obok komórki
  setTimeout(() => {
    const input = document.querySelector(".input-liczby input");
    if (input) {
      input.value = "";
      input.focus();
      input.select();
    }
    positionPanelNearCell(komorka);
  }, 50);
  
  // Dodaj event listener na panel aby go schować
  panel.onmouseleave = () => {
    panel.classList.remove("aktywny");
    document.getElementById("opcje").innerHTML = "";
    aktywnaKomorka = null;
  };
}

// Ustaw pozycję panelu obok podanej komórki, dbając o granice ekranu
function positionPanelNearCell(komorka) {
  const panel = document.getElementById('panel');
  if (!komorka || !panel) return;
  // Najpierw upewnij się, że panel jest widoczny aby zmierzyć jego rozmiary
  panel.classList.add('aktywny');
  // Mały delay, żeby DOM się wyrenderował
  setTimeout(() => {
    const crect = komorka.getBoundingClientRect();
    const prect = panel.getBoundingClientRect();
    const margin = 8;
    let left = crect.right + margin;
    // jeśli nie mieści się po prawej, postaraj się po lewej
    if (left + prect.width > window.innerWidth - margin) {
      left = crect.left - prect.width - margin;
    }
    if (left < margin) left = margin;

    // Wyrównaj pionowo względem komórki, ale mieszcz w oknie
    let top = crect.top;
    if (top + prect.height > window.innerHeight - margin) {
      top = window.innerHeight - prect.height - margin;
    }
    if (top < margin) top = margin;

    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
  }, 0);
}

/* =======================
   OPCJE
======================= */
function renderOpcje(pole) {
  const box = document.getElementById("opcje");
  box.innerHTML = "";
  
  // Usuń stare potwierdzenia z panelu (mogą być od poprzedniego gracza)
  const oldConfirm = document.getElementById('panel').querySelector('.inline-confirm');
  if (oldConfirm) oldConfirm.remove();

  // Dodaj input dla wpisania liczby
  const inputDiv = document.createElement("div");
  inputDiv.className = "input-liczby";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "50";
  input.placeholder = "Wpisz liczbę";
  input.spellcheck = false;
  
  input.onkeypress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = parseInt(input.value);
      if (!isNaN(val) && pola[pole].includes(val)) {
        zapisz(val);
      } else {
        showErrorNotification(`${val} nie jest dostępną wartością dla ${pole}`);
        input.value = "";
        input.focus();
      }
    }
  };
  
  input.onkeydown = (e) => {
    if (e.key === "Escape") {
      const panel = document.getElementById("panel");
      panel.classList.remove("aktywny");
      document.getElementById("opcje").innerHTML = "";
      aktywnaKomorka = null;
    }
  };
  
  inputDiv.appendChild(input);
  box.appendChild(inputDiv);

  // Separator
  const sep = document.createElement("div");
  sep.className = "separator";
  sep.innerText = "LUB - kliknij przycisk";
  box.appendChild(sep);

  // Przyciski opcji
  const buttonsDiv = document.createElement("div");
  buttonsDiv.className = "options-grid";
  
  pola[pole].forEach(v => {
    const b = document.createElement("button");
    b.innerText = v;
    b.onclick = () => zapisz(v);
    b.className = "option-btn";
    buttonsDiv.appendChild(b);
  });
  box.appendChild(buttonsDiv);

  // Filtr na żywo: pokazuj tylko opcje zawierające wpisany ciąg
  input.oninput = () => {
    const q = String(input.value).trim();
    const btns = buttonsDiv.querySelectorAll('.option-btn');
    btns.forEach(b => {
      if (!q) {
        b.style.display = '';
        return;
      }
      if (String(b.innerText).includes(q)) b.style.display = '';
      else b.style.display = 'none';
    });
  };
}

// Undo ostatniej akcji (bez potwierdzenia) - przywraca stan z ostatniego push
function undoLast() {
  if (undoStack.length === 0) return;
  const snap = undoStack.pop();
  // Przywróć wartości pola
  const { cell, oldText, oldLocked, prevGenerałLicznik, prevGenerałWynik, prevActiveGracz, gracz } = snap;
  if (cell) {
    cell.innerText = oldText;
    if (oldLocked) cell.classList.add('zablokowane'); else cell.classList.remove('zablokowane');
  }
  // Przywróć generala
  if (prevGenerałLicznik) generałLicznik = prevGenerałLicznik.slice();
  if (prevGenerałWynik) generałWynik = prevGenerałWynik.slice();
  
  // Przywróć komórkę Generału jeśli został zmieniony bonus
  if (prevGenerałWynik && gracz !== undefined) {
    const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
    if (generalRow) {
      const generalCell = generalRow.cells[gracz + 1];
      if (generalCell) generalCell.innerText = prevGenerałWynik[gracz];
    }
  }
  
  aktywnyGracz = prevActiveGracz;
  przeliczSumy();
  aktualizujTure();
}

// Handler wywoływany przez przycisk Cofnij (pokazuje potwierdzenie)
function requestUndo(targetEl) {
  if (undoStack.length === 0) {
    if (targetEl) showInlineConfirmNear(targetEl, 'Brak akcji do cofnięcia.', () => {}, () => {});
    else showInlineConfirm('Brak akcji do cofnięcia.', () => {}, () => {});
    return;
  }
  if (targetEl) showInlineConfirmNear(targetEl, 'Cofnąć ostatnią akcję?', () => undoLast(), () => {});
  else showInlineConfirm('Cofnąć ostatnią akcję?', () => undoLast(), () => {});
}

// Rozpocznij nową grę - po potwierdzeniu
function resetGame() {
  // pokaż ekran startowy, zresetuj stany
  // pokaż ekran startowy i ustaw go na pierwszy etap wyboru liczby graczy
  document.getElementById('start').style.display = 'block';
  document.getElementById('etap-liczba').style.display = 'block';
  document.getElementById('etap-nazwy').style.display = 'none';
  document.getElementById('etap-start').style.display = 'none';
  
  // Ukryj elementy gry
  document.getElementById("tura").classList.remove("aktywna");
  document.querySelector(".layout").classList.remove("aktywna");
  document.getElementById("controls").classList.remove("aktywna");
  
  const tabela = document.getElementById('tabela');
  // usuń wszystkie wiersze poza nagłówkiem
  while (tabela.rows.length > 1) tabela.deleteRow(1);
  // przywróć nagłówek
  const headerRow = tabela.rows[0];
  while (headerRow.cells.length > 1) headerRow.deleteCell(1);
  // reset danych
  aktywnyGracz = null;
  // wyczyść ewentualne nazwy aby użytkownik wybrał nowe (pozostaw liczbę graczy)
  nazwyGraczy = new Array(liczbaGraczy).fill("");
  aktywnaKomorka = null;
  generałLicznik = new Array(liczbaGraczy).fill(0);
  generałWynik = new Array(liczbaGraczy).fill(0);
  undoStack = [];
  document.getElementById('panel').classList.remove('aktywny');
}

function requestNewGame(targetEl) {
  if (targetEl) showInlineConfirmNear(targetEl, 'Rozpocząć nową grę? Wszystkie dane zostaną utracone.', () => resetGame(), () => {});
  else showInlineConfirm('Rozpocząć nową grę? Wszystkie dane zostaną utracone.', () => resetGame(), () => {});
}

// Obsłuż Ctrl+Z (cofnij)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    const btnUndo = document.getElementById('btnUndo');
    requestUndo(btnUndo);
  }
});

// Robust binding for control buttons. Call on load and after UI changes if needed.
function bindControlButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnNew = document.getElementById('btnNewGame');
  if (btnUndo) {
    // Ensure only one handler is attached
    btnUndo.onclick = (e) => { e.preventDefault(); requestUndo(btnUndo); };
    btnUndo.removeEventListener('click', requestUndo);
    btnUndo.addEventListener('click', () => requestUndo(btnUndo));
  }
  if (btnNew) {
    btnNew.onclick = (e) => { e.preventDefault(); requestNewGame(btnNew); };
    btnNew.removeEventListener('click', requestNewGame);
    btnNew.addEventListener('click', () => requestNewGame(btnNew));
  }
}

// Bind immediately (script is at end of body) and also after starting/resetting game
bindControlButtons();

// Pokazuje fajny notification o błędzie (np. złą wartość)
function showErrorNotification(message) {
  // Usuń stary notification jeśli istnieje
  const existing = document.querySelector('.error-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'error-notification';
  
  const content = document.createElement('div');
  content.className = 'error-content';
  content.innerHTML = `⚠️ ${message}`;
  notification.appendChild(content);
  
  document.body.appendChild(notification);
  
  // Auto-hide po 3 sekundach
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
  
  // Kliknięcie na notification zamyka ją
  notification.onclick = () => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  };
}

// Pokazuje wewnętrzne potwierdzenie w panelu (nie używa alert/confirm)
function showInlineConfirm(message, onYes, onNo) {
  // usuń istniejące globalne potwierdzenia
  const existing = document.body.querySelector('.inline-confirm.global-fixed');
  if (existing) existing.remove();
  const existingOverlay = document.body.querySelector('.confirm-overlay');
  if (existingOverlay) existingOverlay.remove();

  // Dodaj overlay - tło które będzie blokować interakcje z grą
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  overlay.style.zIndex = 2250;
  overlay.onclick = () => {
    // Kliknięcie na overlay = odpowiedź "Nie"
    if (box) box.remove();
    overlay.remove();
    if (onNo) onNo();
  };
  document.body.appendChild(overlay);

  const box = document.createElement('div');
  box.className = 'inline-confirm global-fixed';
  box.style.position = 'fixed';
  box.style.zIndex = 2300;
  box.style.minWidth = '280px';
  box.style.maxWidth = '450px';
  box.style.padding = '16px';
  box.style.borderRadius = '8px';
  box.style.backgroundColor = 'white';
  box.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';

  const msg = document.createElement('div');
  msg.className = 'inline-confirm-msg';
  msg.innerText = message;
  box.appendChild(msg);

  const actions = document.createElement('div');
  actions.className = 'inline-confirm-actions';
  actions.style.marginTop = '16px';

  const yes = document.createElement('button');
  yes.className = 'inline-yes';
  yes.innerText = 'Tak';
  yes.onclick = () => {
    box.remove();
    overlay.remove();
    if (onYes) onYes();
  };

  const no = document.createElement('button');
  no.className = 'inline-no';
  no.innerText = 'Nie';
  no.onclick = () => {
    box.remove();
    overlay.remove();
    if (onNo) onNo();
  };

  actions.appendChild(yes);
  actions.appendChild(no);
  box.appendChild(actions);

  document.body.appendChild(box);

  // Pozycjonuj w centrum ekranu
  const brect = box.getBoundingClientRect();
  const left = (window.innerWidth - brect.width) / 2;
  const top = (window.innerHeight - brect.height) / 2;

  box.style.left = Math.round(left) + 'px';
  box.style.top = Math.round(top) + 'px';

  // Auto-focus "Tak" button i pozwól Enter/Escape
  setTimeout(() => {
    yes.focus();
  }, 0);

  const onBoxKeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      yes.click();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      no.click();
    }
  };
  box.addEventListener('keydown', onBoxKeydown);
}

// Pokazuje potwierdzenie obok danego elementu (np. przycisku)
function showInlineConfirmNear(targetEl, message, onYes, onNo) {
  // usuń istniejące globalne potwierdzenia
  const existing = document.body.querySelector('.inline-confirm.global');
  if (existing) existing.remove();

  const box = document.createElement('div');
  box.className = 'inline-confirm global';
  box.style.position = 'fixed';
  box.style.zIndex = 2300;

  const msg = document.createElement('div');
  msg.className = 'inline-confirm-msg';
  msg.innerText = message;
  box.appendChild(msg);

  const actions = document.createElement('div');
  actions.className = 'inline-confirm-actions';

  const yes = document.createElement('button');
  yes.className = 'inline-yes';
  yes.innerText = 'Tak';
  yes.onclick = () => { box.remove(); if (onYes) onYes(); };

  const no = document.createElement('button');
  no.className = 'inline-no';
  no.innerText = 'Nie';
  no.onclick = () => { box.remove(); if (onNo) onNo(); };

  actions.appendChild(yes);
  actions.appendChild(no);
  box.appendChild(actions);

  document.body.appendChild(box);

  // Pozycjonuj względem targetEl
  const rect = targetEl.getBoundingClientRect();
  const margin = 8;
  let left = rect.right + margin;
  let top = rect.top;

  const brect = box.getBoundingClientRect();
  if (left + brect.width > window.innerWidth - margin) {
    left = rect.left - brect.width - margin;
  }
  if (left < margin) left = margin;
  if (top + brect.height > window.innerHeight - margin) {
    top = window.innerHeight - brect.height - margin;
  }
  if (top < margin) top = margin;

  box.style.left = Math.round(left) + 'px';
  box.style.top = Math.round(top) + 'px';

  // Auto-focus "Tak" button i pozwól Enter aby go zatwierdzić
  setTimeout(() => {
    yes.focus();
  }, 0);

  // Obsłuż Enter aby zatwierdzić (kliknięcie "Tak")
  const onBoxKeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      yes.click();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      no.click();
    }
  };
  box.addEventListener('keydown', onBoxKeydown);

  // If user clicks outside, remove the confirm
  const onDocClick = (e) => {
    if (!box.contains(e.target) && e.target !== targetEl) {
      box.remove();
      document.removeEventListener('mousedown', onDocClick);
      box.removeEventListener('keydown', onBoxKeydown);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
}

/* =======================
   ZAPIS
======================= */
function zapisz(wartosc) {
  let { pole, gracz, komorka } = aktywnaKomorka;
  let wynik = wartosc;

  function createSnapshot() {
    return {
      pole,
      gracz,
      cell: komorka,
      oldText: komorka ? komorka.innerText : '',
      oldLocked: komorka ? komorka.classList.contains('zablokowane') : false,
      prevGenerałLicznik: generałLicznik.slice(),
      prevGenerałWynik: generałWynik.slice(),
      prevActiveGracz: aktywnyGracz
    };
  }

  function finishSave() {
    komorka.innerText = wynik;
    komorka.classList.add("zablokowane");

    aktywnaKomorka = null;
    document.getElementById("panel").classList.remove("aktywny");
    document.getElementById("opcje").innerHTML = "";

    przeliczSumy();

    aktywnyGracz = (aktywnyGracz + 1) % liczbaGraczy;
    aktualizujTure();
    
    // Sprawdź czy gra się skończyła
    setTimeout(() => checkGameEnd(), 100);
  }

  // GENERAŁ - główny wpis
  if (pole === "Generał" && wartosc === 50) {
    if (generałLicznik[gracz] === 0) {
      generałWynik[gracz] = 50;
      generałLicznik[gracz] = 1;
    } else {
      generałWynik[gracz] += 100;
    }
    wynik = generałWynik[gracz];
  }
  
  // Sprawdzenie czy to może być drugi/trzeci generał na innym polu
  const polaZGeneralem = ["Jedynki", "Dwójki", "Trójki", "Czwórki", "Piątki", "Szóstki",
                          "Trzy jednakowe", "Cztery jednakowe", "Full", "Mały strit", "Duży strit", "Szansa"];

  if (generałLicznik[gracz] > 0 && pole !== "Generał" && polaZGeneralem.includes(pole)) {
    let czySzansa = pole === "Szansa";
    let needsConfirm = false;
    let confirmMessage = '';

    if (czySzansa && [5, 10, 15, 20, 25, 30].includes(wartosc)) {
      needsConfirm = true;
      confirmMessage = 'Czy to jest generał (5 jednakowych)?\nDodać +100 do głównego generała?';
    } else if (!czySzansa) {
      const maxValue = Math.max(...pola[pole]);
      if (wartosc === maxValue) {
        needsConfirm = true;
        confirmMessage = 'Czy to jest generał?\nDodać +100 do głównego generała?';
      }
    }

    if (needsConfirm) {
      // pokaż wewnętrzne potwierdzenie i zakończ zapis dopiero po decyzji
      showInlineConfirm(confirmMessage, () => {
        // Tak: dodaj +100 do generała i zapisz
        const snap = createSnapshot();
        generałWynik[gracz] += 100;
        // Aktualizuj pole Generał (jeśli istnieje)
        const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
        if (generalRow) {
          const generalCell = generalRow.cells[gracz + 1];
          if (generalCell) generalCell.innerText = generałWynik[gracz];
        }
        undoStack.push(snap);
        finishSave();
      }, () => {
        // Nie: zapisz wartość BEZ +100 bonusu, przejdź do następnego gracza
        const snap = createSnapshot();
        undoStack.push(snap);
        finishSave();
      });
      return;
    }
  }

  // Brak potrzeby potwierdzenia: zapisz i dodaj snapshot do stosu
  const snap = createSnapshot();
  undoStack.push(snap);
  finishSave();
}

/* =======================
   SUMY I PREMIA
======================= */
function przeliczSumy() {
  for (let g = 0; g < liczbaGraczy; g++) {
    let sumaGorna = 0;
    let sumaDolna = 0;

    document.querySelectorAll("#tabela tr").forEach(tr => {
      const pole = tr.dataset.pole;
      const cell = tr.cells[g + 1];
      if (!cell || !cell.innerText) return;

      const val = parseInt(cell.innerText);

      if (gornePola.includes(pole)) sumaGorna += val;
      else if (pole) sumaDolna += val;
    });

    const premia = sumaGorna >= 63 ? 35 : 0;
    // Premia widoczna ponad sumą górną, ale jest wliczana do sumy górnej
    const sumaGornaZPremia = sumaGorna + premia;
    wpiszSume("Premia", g, premia);
    wpiszSume("Suma górna", g, sumaGornaZPremia);
    wpiszSume("Suma dolna", g, sumaDolna);
    wpiszSume("RAZEM", g, sumaGornaZPremia + sumaDolna);
  }
}

function wpiszSume(nazwa, gracz, wartosc) {
  document
    .querySelector(`tr[data-sum="${nazwa}"]`)
    .cells[gracz + 1].innerText = wartosc;
}

/* =======================
   KONIEC GRY
======================= */
function checkGameEnd() {
  const tabela = document.getElementById("tabela");
  
  // Sprawdź czy wszystkie pola (poza sumami) są zablokowane dla wszystkich graczy
  for (let g = 0; g < liczbaGraczy; g++) {
    let allFilled = true;
    const fieldRows = Array.from(tabela.rows).filter(tr => tr.dataset.pole && !tr.dataset.sum);
    
    for (const row of fieldRows) {
      const cell = row.cells[g + 1];
      if (!cell || !cell.classList.contains('zablokowane')) {
        allFilled = false;
        break;
      }
    }
    
    if (!allFilled) return; // Gra się nie skończyła
  }
  
  // Wszystkie pola wypełnione - pokaż wyniki
  showGameEndModal();
}

function showGameEndModal() {
  // Zbierz ostateczne wyniki
  const results = [];
  for (let g = 0; g < liczbaGraczy; g++) {
    const razem = document.querySelector(`tr[data-sum="RAZEM"]`).cells[g + 1].innerText;
    results.push({
      gracz: g,
      nazwa: nazwyGraczy[g] || `Gracz ${g + 1}`,
      wynik: parseInt(razem) || 0
    });
  }
  
  // Sortuj po wyniku malejąco
  results.sort((a, b) => b.wynik - a.wynik);
  
  // Stwórz modal
  const modal = document.createElement('div');
  modal.className = 'game-end-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'game-end-content';
  
  const title = document.createElement('h2');
  title.innerText = '🎉 Koniec gry!';
  modalContent.appendChild(title);
  
  const winner = results[0];
  const runnerUp = results[1];
  const advantage = winner.wynik - runnerUp.wynik;
  
  const resultText = document.createElement('p');
  resultText.className = 'game-end-result';
  resultText.innerHTML = `<strong>${winner.nazwa}</strong> wygrywa z wynikiem <strong>${winner.wynik}</strong> punktów<br>Przewaga: <strong>+${advantage}</strong> punkty nad ${runnerUp.nazwa}`;
  modalContent.appendChild(resultText);
  
  const ranking = document.createElement('div');
  ranking.className = 'game-end-ranking';
  results.forEach((r, idx) => {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    row.innerHTML = `<span class="rank">${idx + 1}.</span> <span class="name">${r.nazwa}</span> <span class="score">${r.wynik}</span>`;
    ranking.appendChild(row);
  });
  modalContent.appendChild(ranking);
  
  const buttons = document.createElement('div');
  buttons.className = 'game-end-buttons';
  
  const newGameBtn = document.createElement('button');
  newGameBtn.innerText = 'Nowa gra';
  newGameBtn.onclick = () => {
    modal.remove();
    resetGame();
  };
  buttons.appendChild(newGameBtn);
  
  modalContent.appendChild(buttons);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Pokaż modal
  setTimeout(() => modal.classList.add('aktywny'), 0);
}

/* =======================
   POMOCNICZE
======================= */
function gorne(n) {
  return Array.from({ length: 6 }, (_, i) => i * n);
}

function zakres(min, max, krok) {
  let a = [];
  for (let i = min; i <= max; i += krok) a.push(i);
  return a;
}
