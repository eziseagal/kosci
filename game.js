/* =======================
   ZMIENNE GLOBALNE
======================= */
let aktywnyGracz = null;
let aktywnaKomorka = null;
let liczbaGraczy = 2;
let nazwyGraczy = new Array(liczbaGraczy).fill("");
let usedPlayerNames = []; // Lista nicków użytych w bieżącej grze

let generałLicznik = [];
let generałWynik = [];
// Stos do cofania akcji
let undoStack = [];
// Numer aktualnej partii
let currentGameNumber = 0;

// SUPABASE
const SUPABASE_URL = 'https://ucxluytjmrbopiwvqpgl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Yd4-7tGatl3FvmG1Y6C9Nw_Yj_nHs3C';

let supabaseClient = null;

// Inicjalizuj Supabase
async function initSupabase() {
  try {
    if (window.supabase && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase initialized');
      return true;
    } else {
      console.error('Supabase library not loaded');
      return false;
    }
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    return false;
  }
}

// STATYSTYKI I HISTORIA
let gameStats = {
  totalGames: 0,
  gameHistory: [],
  highscores: []
};

// Załaduj statystyki z Supabase
async function loadGameStats() {
  // Jeśli Supabase nie zainicjalizowany, spróbuj go zainicjalizować
  if (!supabaseClient) {
    const success = await initSupabase();
    if (!success) {
      console.warn('Supabase not available, using localStorage fallback');
      const saved = localStorage.getItem('kosciGameStats');
      if (saved) {
        gameStats = JSON.parse(saved);
      }
      updateGameCounter();
      return;
    }
  }

  try {
    // Załaduj licznik gier
    const { data: statsData, error: statsError } = await supabaseClient
      .from('game_stats')
      .select('total_games')
      .eq('id', 1)
      .single();
    
    if (statsError) throw statsError;
    gameStats.totalGames = statsData?.total_games || 0;

    // Załaduj ostatnich 50 gier
    const { data: historyData, error: historyError } = await supabaseClient
      .from('game_history')
      .select('date, results')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (historyError) throw historyError;
    gameStats.gameHistory = historyData || [];

    // Załaduj highscores (z PIN dla weryfikacji)
    const { data: highscoresData, error: highscoresError } = await supabaseClient
      .from('highscores')
      .select('nazwa, wynik, ilosc_partii, pin')
      .order('wynik', { ascending: false });
    
    if (highscoresError) throw highscoresError;
    gameStats.highscores = highscoresData || [];

  } catch (error) {
    console.error('Błąd przy ładowaniu statystyk:', error);
    // Fallback na localStorage jeśli Supabase niedostępny
    const saved = localStorage.getItem('kosciGameStats');
    if (saved) {
      gameStats = JSON.parse(saved);
    }
  }
  
  updateGameCounter();
}

// Zapisz statystyki do Supabase
async function saveGameStats() {
  if (!supabaseClient) {
    console.warn('Supabase not available, using localStorage only');
    localStorage.setItem('kosciGameStats', JSON.stringify(gameStats));
    updateGameCounter();
    return;
  }

  try {
    // Zaktualizuj licznik gier
    const { error: updateError } = await supabaseClient
      .from('game_stats')
      .update({ total_games: gameStats.totalGames })
      .eq('id', 1);
    
    if (updateError) throw updateError;
    
    // Zapamiętaj w localStorage jako backup
    localStorage.setItem('kosciGameStats', JSON.stringify(gameStats));
  } catch (error) {
    console.error('Błąd przy zapisie statystyk:', error);
  }
  
  updateGameCounter();
}

// Aktualizuj wyświetlany licznik partii
function updateGameCounter() {
  const counter = document.getElementById('total-games-counter');
  if (counter) {
    counter.innerText = gameStats.totalGames;
  }
}

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
// Czekaj aż dane się załadują, dopiero inicjalizuj interface
(async () => {
  await loadGameStats();
  init();
  initPlayerCountButtons();
})();

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
    headerRow.insertCell().innerText = nazwyGraczy[g];
  }

  for (let pole in pola) {
    const r = tabela.insertRow();
    r.dataset.pole = pole;
    r.insertCell().innerText = pole;

    for (let g = 0; g < liczbaGraczy; g++) {
      const c = r.insertCell();
      c.classList.add("pole-gry");
      
      // Hover efekt - tylko wizualna wskazówka
      c.onmouseover = () => {
        if (!c.classList.contains("zablokowane") && g === aktywnyGracz) {
          c.style.opacity = "0.8";
        }
      };
      
      c.onmouseleave = () => {
        c.style.opacity = "1";
      };
      
      // Klik - aktywuj input edycji
      c.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!c.classList.contains("zablokowane") && g === aktywnyGracz) {
          wybierzPole(pole, g, c);
          // Ustaw fokus na polu wpisywania
          setTimeout(() => {
            const input = document.querySelector('.input-liczby input');
            if (input) {
              input.focus();
              input.select();
            }
          }, 50);
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

// Sprawdź czy nazwa jest bazowa (Gracz 1, Gracz 2, itd.)
function isDefaultPlayerName(name) {
  return /^Gracz \d+$/i.test(name.trim());
}

function etapNazwy() {
  // liczbaGraczy jest już ustawiona z kliknięcia przycisku
  
  document.getElementById("etap-liczba").style.display = "none";
  document.getElementById("etap-nazwy").style.display = "block";
  
  const inputsDiv = document.getElementById("nazwa-inputs");
  inputsDiv.innerHTML = "";
  
  nazwyGraczy = new Array(liczbaGraczy).fill("");
  usedPlayerNames = []; // Resetuj listę użytych nicków
  
  // Wyciągnij tylko graczy którzy mają zarejestrowany PIN (z tabeli highscores)
  const registeredPlayersArray = (gameStats.highscores || [])
    .map(hs => hs.nazwa)
    .sort((a, b) => a.localeCompare(b, 'pl'));
  
  for (let g = 0; g < liczbaGraczy; g++) {
    const label = document.createElement("label");
    label.innerText = `Gracz ${g + 1}: `;
    
    // Utwórz kontener z inputem i przyciskiem dropdown
    const inputContainer = document.createElement("div");
    inputContainer.className = "nazwa-input-container";
    
    const input = document.createElement("input");
    input.type = "text";
    input.value = "";
    input.placeholder = `Wpisz nick`;
    input.playerIndex = g;
    
    input.onchange = (e) => { 
      nazwyGraczy[g] = e.target.value.trim(); 
    };
    
    input.onblur = (e) => { 
      // Nic - logika tylko na Enter
    };
    
    input.onkeydown = async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newName = input.value.trim();
        
        // Sprawdź czy wprowadzono nazwę
        if (!newName) {
          showPINTooltip(input, '❌ Wprowadź nick!', 'error', 1500);
          return;
        }
        
        // Sprawdź czy nie jest bazową nazwą
        if (isDefaultPlayerName(newName)) {
          showPINTooltip(input, '❌ Wybierz unikalny nick!', 'error', 1500);
          return;
        }
        
        // Sprawdź czy nick już użyty w tej grze
        if (usedPlayerNames.includes(newName) && newName !== nazwyGraczy[g]) {
          showPINTooltip(input, '❌ Nick wybrano już!', 'error', 1500);
          return;
        }
        
        // Sprawdź czy to istniejący gracz
        const isExistingPlayer = registeredPlayersArray.includes(newName);
        
        if (isExistingPlayer) {
          // Istniejący gracz - weryfikacja PIN
          const pinResult = await showInlinePINDialog(newName, true);
          if (pinResult.cancelled) {
            return;
          }
          // Weryfikuj PIN w bazie
          const pinValid = await verifyPlayerPIN(newName, pinResult.pin);
          if (!pinValid) {
            showPINTooltip(input, '❌ Nieprawidłowy PIN!', 'error', 1500);
            return;
          }
          nazwyGraczy[g] = newName;
          usedPlayerNames.push(newName);
          showPINTooltip(input, '✅ Zalogowano!', 'success', 1000);
        } else {
          // Nowy gracz - rejestracja PIN
          const pinResult = await showInlinePINDialog(newName, false);
          if (pinResult.cancelled) {
            return;
          }
          // Zapisz nowego gracza
          const saved = await createNewPlayerWithPIN(newName, pinResult.pin);
          if (!saved) {
            showPINTooltip(input, '❌ Błąd zapisu!', 'error', 1500);
            return;
          }
          nazwyGraczy[g] = newName;
          usedPlayerNames.push(newName);
          showPINTooltip(input, '✅ Zarejestrowano!', 'success', 1000);
        }
        
        input.value = nazwyGraczy[g];
        
        // Przejdź do następnego gracza
        setTimeout(() => {
          if (g === liczbaGraczy - 1) {
            etapStartowania();
          } else {
            const nextInput = inputsDiv.querySelectorAll('input')[g + 1];
            if (nextInput) nextInput.focus();
          }
        }, 500);
      }
    };
    
    // Przycisk dropdown
    const dropdownBtn = document.createElement("button");
    dropdownBtn.className = "nazwa-input-dropdown-btn";
    dropdownBtn.innerText = "▼";
    dropdownBtn.type = "button";
    
    // Dropdown z listą
    const dropdown = document.createElement("div");
    dropdown.className = "nazwa-input-dropdown";
    
    registeredPlayersArray.forEach(playerName => {
      const item = document.createElement("div");
      item.className = "nazwa-input-dropdown-item";
      item.innerText = playerName;
      item.onclick = async (e) => {
        e.stopPropagation();
        
        // Sprawdź czy nick już użyty w tej grze
        if (usedPlayerNames.includes(playerName)) {
          showPINTooltip(input, '❌ Nick już wybrany!', 'error', 1500);
          return;
        }
        
        // Weryfikacja PIN dla istniejącego gracza
        const pinResult = await showInlinePINDialog(playerName, true);
        if (pinResult.cancelled) {
          return;
        }
        // Weryfikuj PIN w bazie
        const pinValid = await verifyPlayerPIN(playerName, pinResult.pin);
        if (!pinValid) {
          showPINTooltip(input, '❌ Nieprawidłowy PIN!', 'error', 1500);
          return;
        }
        
        input.value = playerName;
        nazwyGraczy[g] = playerName;
        usedPlayerNames.push(playerName);
        dropdown.classList.remove("aktywny");
        input.focus();
      };
      dropdown.appendChild(item);
    });
    
    // Toggle dropdown
    dropdownBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle("aktywny");
    };
    
    // Zamknij dropdown przy kliknięciu poza
    inputContainer.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    
    inputContainer.appendChild(input);
    if (registeredPlayersArray.length > 0) {
      inputContainer.appendChild(dropdownBtn);
    }
    inputContainer.appendChild(dropdown);
    
    const div = document.createElement("div");
    div.className = "nazwa-input";
    div.appendChild(label);
    div.appendChild(inputContainer);
    inputsDiv.appendChild(div);
  }
  
  // Zamknij wszystkie dropdowny przy kliknięciu poza
  const handleClickOutside = (e) => {
    const dropdowns = inputsDiv.querySelectorAll('.nazwa-input-dropdown');
    dropdowns.forEach(dp => {
      if (!dp.parentElement.contains(e.target)) {
        dp.classList.remove('aktywny');
      }
    });
  };
  document.addEventListener('click', handleClickOutside, true);
  
  // Ustaw fokus na pierwszym inputie
  setTimeout(() => {
    const firstInput = inputsDiv.querySelector('input');
    if (firstInput) firstInput.focus();
  }, 0);
}

// Inline wiadomość nad inputem
function showPINTooltip(inputElement, message, type = 'error', duration = 1500) {
  // Usuń stary tooltip
  const existing = document.querySelector('.pin-tooltip');
  if (existing) existing.remove();
  
  // Oblicz pozycję PRZED dodaniem do DOM
  const rect = inputElement.getBoundingClientRect();
  
  const tooltip = document.createElement('div');
  tooltip.className = `pin-tooltip pin-tooltip-${type}`;
  tooltip.innerText = message;
  
  // Dodaj tymczasowo żeby zmierzyć szerokość
  tooltip.style.visibility = 'hidden';
  document.body.appendChild(tooltip);
  
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
  const tooltipTop = rect.top - 40;
  
  // Ustaw właściwą pozycję
  tooltip.style.visibility = 'visible';
  tooltip.style.left = tooltipLeft + 'px';
  tooltip.style.top = tooltipTop + 'px';
  
  if (duration > 0) {
    setTimeout(() => tooltip.remove(), duration);
  }
}

// Tooltip na środku ekranu dla globalnych komunikatów
function showCenterTooltip(message, type = 'error', duration = 2500) {
  // Usuń stary tooltip
  const existing = document.querySelector('.center-tooltip');
  if (existing) existing.remove();
  
  const tooltip = document.createElement('div');
  tooltip.className = `center-tooltip center-tooltip-${type}`;
  tooltip.innerText = message;
  tooltip.style.opacity = '0';
  
  document.body.appendChild(tooltip);
  
  // Pokaż tooltip po dodaniu do DOM
  setTimeout(() => {
    tooltip.style.opacity = '1';
  }, 10);
  
  if (duration > 0) {
    setTimeout(() => {
      tooltip.style.opacity = '0';
      setTimeout(() => tooltip.remove(), 300);
    }, duration);
  }
}

function showInlineMessage(inputElement, message, type = 'error', duration = 2000) {
  // Usuń starą wiadomość
  const existing = inputElement.parentElement.querySelector('.inline-message');
  if (existing) existing.remove();
  
  const messageEl = document.createElement('div');
  messageEl.className = 'inline-message';
  messageEl.style.cssText = `
    color: ${type === 'error' ? '#f44336' : '#4caf50'};
    font-size: 0.85em;
    margin-top: 5px;
    animation: fadeIn 0.3s;
  `;
  messageEl.innerText = message;
  inputElement.parentElement.appendChild(messageEl);
  
  if (duration > 0) {
    setTimeout(() => messageEl.remove(), duration);
  }
}

// Inline PIN dialog
async function showInlinePINDialog(playerName, isExisting) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 2500;';
    
    const box = document.createElement('div');
    box.style.cssText = 'background: white; padding: 30px; border-radius: 10px; text-align: center; min-width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);';
    
    const title = document.createElement('h3');
    title.innerText = isExisting ? '🔐 Logowanie' : '🔐 Rejestracja PIN';
    title.style.cssText = 'margin: 0 0 10px 0; color: #2c3e50;';
    box.appendChild(title);
    
    const nameSpan = document.createElement('p');
    nameSpan.innerText = playerName;
    nameSpan.style.cssText = 'font-size: 0.95em; color: #666; margin: 0 0 15px 0; font-weight: 600;';
    box.appendChild(nameSpan);
    
    const desc = document.createElement('p');
    desc.innerText = isExisting ? 'Wpisz 4-cyfrowy PIN:' : 'Ustaw 4-cyfrowy PIN:';
    desc.style.cssText = 'font-size: 0.9em; color: #999; margin: 0 0 12px 0;';
    box.appendChild(desc);
    
    const input = document.createElement('input');
    input.type = 'password';
    input.maxLength = '4';
    input.placeholder = '****';
    input.inputMode = 'numeric';
    input.style.cssText = 'width: 100%; padding: 12px; font-size: 1.2em; text-align: center; letter-spacing: 5px; border: 2px solid #ddd; border-radius: 6px; margin: 0 0 15px 0; box-sizing: border-box;';
    box.appendChild(input);
    
    const buttonDiv = document.createElement('div');
    buttonDiv.style.cssText = 'display: flex; gap: 10px;';
    
    const okBtn = document.createElement('button');
    okBtn.innerText = 'OK';
    okBtn.style.cssText = 'flex: 1; padding: 10px; background: #2196f3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;';
    okBtn.onmouseover = () => okBtn.style.background = '#1976d2';
    okBtn.onmouseout = () => okBtn.style.background = '#2196f3';
    okBtn.onclick = () => {
      const pin = input.value.trim();
      if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        showPINTooltip(input, '❌ PIN musi zawierać 4 cyfry!', 'error', 2000);
        return;
      }
      overlay.remove();
      resolve({ pin, cancelled: false });
    };
    buttonDiv.appendChild(okBtn);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Anuluj';
    cancelBtn.style.cssText = 'flex: 1; padding: 10px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;';
    cancelBtn.onmouseover = () => cancelBtn.style.background = '#d32f2f';
    cancelBtn.onmouseout = () => cancelBtn.style.background = '#f44336';
    cancelBtn.onclick = () => {
      overlay.remove();
      resolve({ pin: null, cancelled: true });
    };
    buttonDiv.appendChild(cancelBtn);
    
    box.appendChild(buttonDiv);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    input.focus();
    input.onkeydown = (e) => {
      if (e.key === 'Enter') okBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    };
  });
}

// Waliduj wszystkie nazwy graczy i upewnij się że mają PIN
async function validateAndProceedToStart() {
  // Sprawdź czy wszystkie nazwy są wypełnione i unikalne
  for (let i = 0; i < liczbaGraczy; i++) {
    const playerName = nazwyGraczy[i];
    
    // Sprawdź czy nazwa jest pusta
    if (!playerName || playerName.trim() === '') {
      showCenterTooltip(`Gracz ${i + 1}: Wprowadź nick przed przejściem dalej!`, 'error', 2500);
      return;
    }
    
    // Sprawdź czy nazwa nie jest bazowa
    if (isDefaultPlayerName(playerName)) {
      showCenterTooltip(`Gracz ${i + 1}: Wybierz unikalny nick zamiast "${playerName}"!`, 'error', 2500);
      return;
    }
  }
  
  const registeredPlayersArray = (gameStats.highscores || [])
    .map(hs => hs.nazwa)
    .sort((a, b) => a.localeCompare(b, 'pl'));
  
  // Sprawdź każdego gracza i zapewnij PIN
  for (let i = 0; i < liczbaGraczy; i++) {
    const playerName = nazwyGraczy[i];
    
    // Jeśli gracz nie został przetworzony przez Enter (nie ma w usedPlayerNames)
    if (!usedPlayerNames.includes(playerName)) {
      const isExisting = registeredPlayersArray.includes(playerName);
      
      if (isExisting) {
        // Istniejący gracz - wymaga PIN
        const pinResult = await showInlinePINDialog(playerName, true);
        if (pinResult.cancelled) {
          return; // Anulowano - nie przechodź dalej
        }
        
        const pinValid = await verifyPlayerPIN(playerName, pinResult.pin);
        if (!pinValid) {
          showCenterTooltip('Nieprawidłowy PIN dla gracza: ' + playerName, 'error', 2500);
          return; // Nie przechodź dalej
        }
        
        usedPlayerNames.push(playerName);
      } else {
        // Nowy gracz - wymaga rejestracji PIN
        const pinResult = await showInlinePINDialog(playerName, false);
        if (pinResult.cancelled) {
          return; // Anulowano - nie przechodź dalej
        }
        
        const saved = await createNewPlayerWithPIN(playerName, pinResult.pin);
        if (!saved) {
          showCenterTooltip('Błąd przy zapisywaniu gracza: ' + playerName, 'error', 2500);
          return; // Nie przechodź dalej
        }
        
        usedPlayerNames.push(playerName);
      }
    }
  }
  
  // Wszyscy gracze zwalidowani - przejdź dalej
  etapStartowania();
}

function etapStartowania() {
  document.getElementById("etap-nazwy").style.display = "none";
  document.getElementById("etap-start").style.display = "block";
  
  const startDiv = document.getElementById("gracz-startowy");
  startDiv.innerHTML = "";
  
  for (let g = 0; g < liczbaGraczy; g++) {
    const btn = document.createElement("button");
    btn.innerText = nazwyGraczy[g];
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
  
  // Ustaw numer aktualnej partii
  currentGameNumber = gameStats.totalGames + 1;
  
  // Jeśli nie wybrano aktywnego gracza (np. kliknięto "Rozpocznij grę" bez wyboru), losuj startującego
  if (aktywnyGracz === null || typeof aktywnyGracz !== 'number') {
    aktywnyGracz = Math.floor(Math.random() * liczbaGraczy);
  }

  document.getElementById("start").style.display = "none";
  
  // Pokaż elementy gry
  document.getElementById("tura").classList.add("aktywna");
  document.getElementById("partia-nr").classList.add("aktywna");
  document.querySelector(".layout").classList.add("aktywna");
  document.getElementById("controls").classList.add("aktywna");
  
  init();
  aktualizujTure();
  // Re-bind buttons in case DOM changed
  bindControlButtons();
  // Ensure top-left controls float and reserve table space
  setupFloatingLeftControls();
}

/* =======================
   TURA
======================= */
function aktualizujTure() {
  const nazwa = nazwyGraczy[aktywnyGracz];
  document.getElementById("tura").innerText = `Tura: ${nazwa}`;
  document.getElementById("partia-nr").innerText = `Partia: ${currentGameNumber}`;

  document.querySelectorAll("td").forEach(td => {
    td.classList.remove("aktywny-gracz");
  });

  document.querySelectorAll("#tabela tr").forEach(tr => {
    // Skip summary rows (they use data-sum) so they are not highlighted
    if (tr.dataset && tr.dataset.sum) return;
    const td = tr.cells[aktywnyGracz + 1];
    if (td && !td.classList.contains('zablokowane')) {
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

  const panel = document.getElementById("panel");
  
  // Jeśli panel był aktywny, czekaj aż transition się skończy
  if (panel.classList.contains("aktywny")) {
    // Wyczyść zawartość zaraz (bez delay)
    document.getElementById("opcje").innerHTML = "";
    panel.classList.remove("aktywny");
    // Czekaj na koniec transition (0.2s) + mały margin
    setTimeout(() => {
      openPanel(pole, gracz, komorka);
    }, 210);
  } else {
    // Jeśli panel był zamknięty, otwórz od razu
    openPanel(pole, gracz, komorka);
  }
}

function openPanel(pole, gracz, komorka) {
  aktywnaKomorka = { pole, gracz, komorka };
  const panel = document.getElementById("panel");
  
  document.getElementById("opis").innerText =
    `${pole} – ${nazwyGraczy[gracz]}`;

  renderOpcje(pole);
  
  // Wyrenderuj zawartość, potem pozycjonuj i pokaż
  setTimeout(() => {
    // Pozycjonuj panel gdy zawartość jest już wyrenderowana
    positionPanelNearCell(komorka);
    
    // Dodaj klasę aktywny - panel pojawi się już na prawidłowym miejscu
    panel.classList.add("aktywny");
    
    const input = document.querySelector(".input-liczby input");
    if (input) {
      input.value = "";
      input.focus();
      input.select();
    }
  }, 50);
}

// Ustaw pozycję panelu obok podanej komórki, dbając o granice ekranu
function positionPanelNearCell(komorka) {
  const panel = document.getElementById('panel');
  if (!komorka || !panel) return;
  
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
}

/* =======================
   OPCJE
======================= */
function renderOpcje(pole) {
  const box = document.getElementById("opcje");
  box.innerHTML = "";

  // Dodaj input dla wpisania liczby
  const inputDiv = document.createElement("div");
  inputDiv.className = "input-liczby";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "50";
  input.placeholder = "";
  input.spellcheck = false;
  input.autofocus = true;
  
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

// Zamknij panel gdy kliknę poza
document.addEventListener('mousedown', (e) => {
  const panel = document.getElementById('panel');
  if (!panel) return;
  
  // Nie zamykaj panelu gdy klikam na komórkę gry (zaraz onclick otworzy nowy)
  if (e.target.closest('td.pole-gry')) {
    return;
  }
  
  if (aktywnaKomorka && panel.classList.contains('aktywny')) {
    const { komorka } = aktywnaKomorka;
    // Jeśli kliknie poza panelem I poza komórką, zamknij panel
    if (!panel.contains(e.target) && !komorka.contains(e.target)) {
      panel.classList.remove('aktywny');
      document.getElementById('opcje').innerHTML = '';
      aktywnaKomorka = null;
    }
  }
}, true);

/* =======================
   UNDO
======================= */
function undoLast() {
  if (undoStack.length === 0) return;
  const snap = undoStack.pop();
  // Przywróć wartości pola
  const { cell, oldText, oldLocked, prevGenerałLicznik, prevGenerałWynik, prevActiveGracz, gracz, clearCellToEmpty } = snap;
  if (cell) {
    // Jeśli snapshot wymusza wyczyszczenie pola (np. cofamy "zwykłego" generala), ustaw puste
    if (clearCellToEmpty) {
      cell.innerText = '';
      cell.classList.remove('zablokowane');
    } else {
      cell.innerText = oldText;
      if (oldLocked) cell.classList.add('zablokowane'); else cell.classList.remove('zablokowane');
    }
  }
  // Przywróć generala
  if (prevGenerałLicznik) generałLicznik = prevGenerałLicznik.slice();
  if (prevGenerałWynik) generałWynik = prevGenerałWynik.slice();
  
  // Przywróć komórkę Generału jeśli został zmieniony bonus
  if (prevGenerałWynik && gracz !== undefined) {
    const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
    if (generalRow) {
      const generalCell = generalRow.cells[gracz + 1];
      if (generalCell) {
        // Jeśli poprzednia wartość generała to 0, traktuj jako puste pole (tak jak w innych wierszach)
        if (prevGenerałWynik[gracz] === 0) {
          generalCell.innerText = '';
          generalCell.classList.remove('zablokowane');
        } else {
          generalCell.innerText = prevGenerałWynik[gracz];
        }
      }
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
  document.getElementById("partia-nr").classList.remove("aktywna");
  document.getElementById("partia-nr").innerText = "";
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
  // remove reserved left space when at start screen
  document.body.classList.remove('left-floating');
  setupFloatingLeftControls();
}

function requestNewGame(targetEl) {
  const msg = 'Rozpocząć nową grę? Wszystkie dane zostaną utracone.';
  if (targetEl) {
    // show inline three-option confirm near the clicked element: Nowa gra | Rewanż | Nie
    showInlineConfirmNearThreeOptions(targetEl, msg,
      'Nowa gra', 'Rewanż', 'Nie',
      () => resetGame(),
      () => replayGame(),
      () => {}
    );
  } else {
    // center modal with two options (Nowa gra / Rewanż)
    showInlineConfirmTwoOptions(msg, 'Nowa gra', 'Rewanż', () => resetGame(), () => replayGame());
  }
}

// Inline confirm placed near a target element with three labeled options
function showInlineConfirmNearThreeOptions(targetEl, message, opt1Label, opt2Label, opt3Label, onOpt1, onOpt2, onOpt3) {
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
  yes.innerText = opt1Label || 'Tak';
  yes.onclick = () => { box.remove(); if (onOpt1) onOpt1(); };

  const rematch = document.createElement('button');
  rematch.className = 'rematch-btn';
  rematch.innerText = opt2Label || 'Rewanż';
  rematch.onclick = () => { box.remove(); if (onOpt2) onOpt2(); };

  const no = document.createElement('button');
  no.className = 'inline-no';
  no.innerText = opt3Label || 'Nie';
  no.onclick = () => { box.remove(); if (onOpt3) onOpt3(); };

  actions.appendChild(yes);
  actions.appendChild(rematch);
  actions.appendChild(no);
  box.appendChild(actions);

  document.body.appendChild(box);

  // Positioning near targetEl
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

  setTimeout(() => yes.focus(), 0);

  const onBoxKeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); yes.click(); }
    if (e.key === 'Escape') { e.preventDefault(); no.click(); }
  };
  box.addEventListener('keydown', onBoxKeydown);

  // remove if clicking outside
  const onDocClick = (e) => {
    if (!box.contains(e.target) && e.target !== targetEl) {
      box.remove();
      document.removeEventListener('mousedown', onDocClick);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
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
  const btnStats = document.getElementById('btnStats');
  if (btnUndo) {
    btnUndo.onclick = (e) => { e.preventDefault(); requestUndo(btnUndo); };
  }
  if (btnNew) {
    btnNew.onclick = (e) => { e.preventDefault(); requestNewGame(btnNew); };
  }
  if (btnStats) {
    btnStats.onclick = (e) => { e.preventDefault(); showStatsPanel(); };
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
    // Jeśli komórka ma input, pobierz aktualną wartość stąd, inaczej z innerText
    let oldTextValue = '';
    const editContainer = komorka ? komorka.querySelector('.cell-edit-container') : null;
    if (editContainer) {
      const input = editContainer.querySelector('.cell-edit-input');
      oldTextValue = input ? input.value : '';
    } else {
      oldTextValue = komorka ? komorka.innerText : '';
    }
    
    return {
      pole,
      gracz,
      cell: komorka,
      oldText: oldTextValue,
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
    
    // Zamknij panel
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
    // Zrób snapshot PRZED zmianą tablic generała, aby undo mógł przywrócić poprzedni stan
    const snap = createSnapshot();
    if (generałLicznik[gracz] === 0) {
      generałWynik[gracz] = 50;
      generałLicznik[gracz] = 1;
    } else {
      generałWynik[gracz] += 100;
    }
    wynik = generałWynik[gracz];
    // Zaktualizuj widok pola Generał
    const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
    if (generalRow) {
      const generalCell = generalRow.cells[gracz + 1];
      if (generalCell) generalCell.innerText = generałWynik[gracz];
    }
    // Dodaj snapshot i zakończ zapis (unikamy podwójnego snapshotu na końcu funkcji)
    undoStack.push(snap);
    finishSave();
    return;
  }
  
  // Sprawdzenie czy to może być drugi/trzeci generał na innym polu
  const polaZGeneralem = ["Jedynki", "Dwójki", "Trójki", "Czwórki", "Piątki", "Szóstki",
                          "Trzy jednakowe", "Cztery jednakowe", "Full", "Mały strit", "Duży strit", "Szansa"];

  if (generałLicznik[gracz] > 0 && pole !== "Generał" && polaZGeneralem.includes(pole)) {
    // Check for 5 of a kind (values 5, 10, 15, 20, 25, 30) in Szansa, Trzy jednakowe, Cztery jednakowe
    const polesWith5OfAKind = ["Szansa", "Trzy jednakowe", "Cztery jednakowe"];
    // Fields from 1 do 6
    const polaOdJedynekDoSzostek = ["Jedynki", "Dwójki", "Trójki", "Czwórki", "Piątki", "Szóstki"];
    let needsConfirm = false;
    let confirmMessage = '';
    let autoAddBonus = false;

    // Pola 1-6 ze wartościami 5,10,15,20,25,30 -> zawsze generał, auto +100
    // Specjalna logika dla Piątek – generał tylko przy 25
    if (pole === "Piątki" && wartosc === 25) {
      autoAddBonus = true;
    }
    // Pozostałe pola 1–6 (bez Piątek)
    else if (pole !== "Piątki" && polaOdJedynekDoSzostek.includes(pole) && [5, 10, 15, 20, 25, 30].includes(wartosc)) {
      autoAddBonus = true;
    } else if (polesWith5OfAKind.includes(pole) && [5, 10, 15, 20, 25, 30].includes(wartosc)) {
      needsConfirm = true;
      confirmMessage = 'Czy to jest generał (5 jednakowych)?\nDodać +100 do głównego generała?';
    } else if (polaOdJedynekDoSzostek.includes(pole) && wartosc === 0) {
      // Pola 1-6 ze wartością 0 przy aktywnym generale -> pytaj
      needsConfirm = true;
      confirmMessage = 'Czy ta wartość 0 jest spowodowana generałem?\nDodać +100 do głównego generała?';
    } else if (!polesWith5OfAKind.includes(pole) && !polaOdJedynekDoSzostek.includes(pole)) {
      const maxValue = Math.max(...pola[pole]);
      if (wartosc === maxValue) {
        needsConfirm = true;
        confirmMessage = 'Czy to jest generał?\nDodać +100 do głównego generała?';
      }
    }

    if (autoAddBonus) {
      // Automatycznie dodaj +100 dla wartości 5,10,15,20,25,30 w polach 1-6
      const snap = createSnapshot();
      snap.clearCellToEmpty = true;
      generałWynik[gracz] += 100;
      // Aktualizuj pole Generał (jeśli istnieje)
      const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
      if (generalRow) {
        const generalCell = generalRow.cells[gracz + 1];
        if (generalCell) generalCell.innerText = generałWynik[gracz];
      }
      undoStack.push(snap);
      finishSave();
      return;
    }

    if (needsConfirm) {
      // pokaż wewnętrzne potwierdzenie i zakończ zapis dopiero po decyzji
      showInlineConfirm(confirmMessage, () => {
        // Tak: dodaj +100 do generała i zapisz
        const snap = createSnapshot();
        // oznacz że to był "zwykły" generał na innym polu — przy cofaniu trzeba wyczyścić to pole
        snap.clearCellToEmpty = true;
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
      nazwa: nazwyGraczy[g],
      wynik: parseInt(razem) || 0
    });
  }
  
  // Sortuj po wyniku malejąco
  results.sort((a, b) => b.wynik - a.wynik);
  
  // ZAPISZ WYNIKI DO SUPABASE I LOKALNIE
  (async () => {
    try {
      // Dodaj grę do historii
      const gameRecord = {
        date: new Date().toLocaleString('pl-PL'),
        results: results.map(r => ({
          nazwa: r.nazwa,
          wynik: r.wynik
        }))
      };

      const { error: insertError } = await supabaseClient
        .from('game_history')
        .insert([gameRecord]);
      
      if (insertError) throw insertError;

      // Aktualizuj highscores
      for (const result of results) {
        const { data: existing, error: selectError } = await supabaseClient
          .from('highscores')
          .select('*')
          .eq('nazwa', result.nazwa)
          .maybeSingle();

        if (selectError) throw selectError;

        if (existing) {
          // Gracz istnieje - aktualizuj jeśli wynik wyższy
          const newWynik = Math.max(existing.wynik, result.wynik);
          const { error: updateError } = await supabaseClient
            .from('highscores')
            .update({
              wynik: newWynik,
              ilosc_partii: existing.ilosc_partii + 1,
              updated_at: new Date().toISOString()
            })
            .eq('nazwa', result.nazwa);
          
          if (updateError) throw updateError;
        } else {
          // Nowy gracz
          const { error: insertScoreError } = await supabaseClient
            .from('highscores')
            .insert([{
              nazwa: result.nazwa,
              wynik: result.wynik,
              ilosc_partii: 1
            }]);
          
          if (insertScoreError) throw insertScoreError;
        }
      }

      // Zwiększ licznik gier
      gameStats.totalGames++;
      const { error: statsError } = await supabaseClient
        .from('game_stats')
        .update({ total_games: gameStats.totalGames })
        .eq('id', 1);
      
      if (statsError) throw statsError;

      // Załaduj zaktualizowane dane
      await loadGameStats();

    } catch (error) {
      console.error('Błąd przy zapisie wyniku:', error);
      showCenterTooltip('Błąd przy zapisie wyniku. Spróbuj ponownie.', 'error', 3000);
      return;
    }

    showGameEndModalUI(results);
  })();
}

// Funkcja do prawidłowej infleksji słowa "punkt/punkty/punktów"
function getPunktForm(n) {
  const abs = Math.abs(n);
  if (abs % 10 === 1 && abs % 100 !== 11) {
    return 'punkt';
  } else if (abs % 10 >= 2 && abs % 10 <= 4 && (abs % 100 < 12 || abs % 100 > 14)) {
    return 'punkty';
  } else {
    return 'punktów';
  }
}


// Weryfikacja PIN dla istniejącego gracza
async function verifyPlayerPIN(playerName, enteredPin) {
  try {
    if (!supabaseClient) return false;
    
    const { data, error } = await supabaseClient
      .from('highscores')
      .select('pin')
      .eq('nazwa', playerName)
      .maybeSingle();
    
    if (error) throw error;
    if (!data || !data.pin) return false;
    
    return data.pin === enteredPin;
  } catch (error) {
    console.error('Błąd weryfikacji PIN:', error);
    return false;
  }
}

// Zapisanie nowego gracza z PIN
async function createNewPlayerWithPIN(playerName, pin) {
  try {
    if (!supabaseClient) return false;
    
    const { error } = await supabaseClient
      .from('highscores')
      .insert([{
        nazwa: playerName,
        wynik: 0,
        ilosc_partii: 0,
        pin: pin
      }]);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Błąd przy tworzeniu nowego gracza:', error);
    return false;
  }
}

function showGameEndModalUI(results) {
  // Stwórz modal
  const modal = document.createElement('div');
  modal.className = 'game-end-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'game-end-content';
  
  const title = document.createElement('h2');
  title.innerText = '🎉 Koniec gry!';
  modalContent.appendChild(title);
  
  // Statystyki gry
  const statsDiv = document.createElement('div');
  statsDiv.className = 'game-stats-summary';
  const totalGamesText = document.createElement('p');
  totalGamesText.innerHTML = `<strong>Zakończono partię:</strong> ${gameStats.totalGames}`;
  statsDiv.appendChild(totalGamesText);
  modalContent.appendChild(statsDiv);
  
  // Obsługa remisu - znajdź wszystkich graczy z najwyższym wynikiem
  const maxScore = results[0].wynik;
  const winners = results.filter(r => r.wynik === maxScore);
  const runnerUp = results.find(r => r.wynik < maxScore);
  
  const resultText = document.createElement('p');
  resultText.className = 'game-end-result';
  
  if (winners.length > 1) {
    // Remis
    const winnerNames = winners.map(w => w.nazwa).join(', ');
    const punktForm = getPunktForm(maxScore);
    resultText.innerHTML = `🤝 <strong>REMIS!</strong><br><strong>${winnerNames}</strong><br>wszyscy mają <strong>${maxScore}</strong> ${punktForm}`;
  } else {
    // Jedna osoba wygrała
    const winner = winners[0];
    const advantage = winner.wynik - (runnerUp ? runnerUp.wynik : 0);
    const punktForm = getPunktForm(advantage);
    resultText.innerHTML = `<strong>${winner.nazwa}</strong> wygrywa z wynikiem <strong>${winner.wynik}</strong> ${getPunktForm(winner.wynik)}<br>Przewaga: <strong>+${advantage}</strong> ${punktForm}`;
  }
  
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
    // Ask whether user wants a fresh new game or a rematch
    showInlineConfirmTwoOptions('Co chcesz zrobić?', 'Nowa gra', 'Rewanż', () => resetGame(), () => replayGame());
  };
  buttons.appendChild(newGameBtn);
  
  // (Przycisk "Zagraj ponownie" usunięty - używamy teraz opcji w potwierdzeniu)
  
  const statsBtn = document.createElement('button');
  statsBtn.innerText = 'Historia rozgrywek';
  statsBtn.onclick = () => {
    modal.remove();
    showStatsPanel();
  };
  buttons.appendChild(statsBtn);
  
  modalContent.appendChild(buttons);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Pokaż modal
  setTimeout(() => modal.classList.add('aktywny'), 0);
}

// Inline confirm with custom labels for the two choices
function showInlineConfirmTwoOptions(message, opt1Label, opt2Label, onOpt1, onOpt2) {
  // remove any existing global confirms/overlays
  const existing = document.body.querySelector('.inline-confirm.global-fixed');
  if (existing) existing.remove();
  const existingOverlay = document.body.querySelector('.confirm-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  overlay.style.zIndex = 2250;
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
  // CSS centering - zawsze będzie na środku ekranu
  box.style.left = '50%';
  box.style.top = '50%';
  box.style.transform = 'translate(-50%, -50%)';

  const msg = document.createElement('div');
  msg.className = 'inline-confirm-msg';
  msg.innerText = message;
  box.appendChild(msg);

  const actions = document.createElement('div');
  actions.className = 'inline-confirm-actions';
  actions.style.marginTop = '16px';

  const opt1 = document.createElement('button');
  opt1.className = 'inline-yes';
  opt1.innerText = opt1Label || 'Tak';
  opt1.onclick = () => { box.remove(); overlay.remove(); if (onOpt1) onOpt1(); };

  const opt2 = document.createElement('button');
  opt2.className = 'inline-no';
  opt2.innerText = opt2Label || 'Nie';
  // mark rematch (rewanż) option with special styling
  opt2.classList.add('rematch-btn');
  opt2.onclick = () => { box.remove(); overlay.remove(); if (onOpt2) onOpt2(); };

  actions.appendChild(opt1);
  actions.appendChild(opt2);
  box.appendChild(actions);

  document.body.appendChild(box);

  setTimeout(() => opt1.focus(), 0);

  const onBoxKeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); opt1.click(); }
    if (e.key === 'Escape') { e.preventDefault(); opt2.click(); }
  };
  box.addEventListener('keydown', onBoxKeydown);
}

// Restart the game immediately with the same players (keep `nazwyGraczy` and `liczbaGraczy`)
function replayGame() {
  // Reset generator arrays and undo stack
  generałLicznik = new Array(liczbaGraczy).fill(0);
  generałWynik = new Array(liczbaGraczy).fill(0);
  undoStack = [];
  aktywnaKomorka = null;

  // Set up a new game number
  currentGameNumber = gameStats.totalGames + 1;

  // Ensure UI shows the game layout
  document.getElementById('start').style.display = 'none';
  document.getElementById('tura').classList.add('aktywna');
  document.getElementById('partia-nr').classList.add('aktywna');
  document.querySelector('.layout').classList.add('aktywna');
  document.getElementById('controls').classList.add('aktywna');

  // Rebuild the table and UI
  init();
  aktualizujTure();
  bindControlButtons();
  setupFloatingLeftControls();
  // position title if needed
  if (typeof updateFloatingTitlePosition === 'function') updateFloatingTitlePosition();
}


// Wyświetl panel statystyk i highscores
function showStatsPanel() {
  const modal = document.createElement('div');
  modal.className = 'stats-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'stats-content';
  
  const title = document.createElement('h2');
  title.innerText = '📊 Historia rozgrywek';
  modalContent.appendChild(title);
  
  // Container for scrollable body (keeps buttons visible)
  const statsBody = document.createElement('div');
  statsBody.className = 'stats-body';

  // HIGHSCORES
  const highscoresSection = document.createElement('div');
  highscoresSection.className = 'stats-section';
  
  const hsTitle = document.createElement('h3');
  hsTitle.innerText = `🏆 Najlepsze wyniki (${gameStats.highscores.length})`;
  highscoresSection.appendChild(hsTitle);
  
  // compute wins per player from gameHistory (only count if exactly one winner - no remis)
  const winsMap = {};
  gameStats.gameHistory.forEach(g => {
    if (g.results && g.results.length > 0) {
      // Znajdź maksymalny wynik w tej grze
      const maxScore = Math.max(...g.results.map(r => r.wynik));
      // Pobierz wszystkich graczy z maksymalnym wynikiem (remis)
      const winners = g.results.filter(r => r.wynik === maxScore);
      // Dodaj +1 tylko jeśli dokładnie jeden zwycięzca (bez remisu)
      if (winners.length === 1 && winners[0].nazwa) {
        winsMap[winners[0].nazwa] = (winsMap[winners[0].nazwa] || 0) + 1;
      }
    }
  });
  // Build highscores table and wrap it in a scrollable container that shows ~5 rows
  const hsWrapper = document.createElement('div');
  hsWrapper.className = 'highscores-wrapper';

  const hsTable = document.createElement('table');
  hsTable.className = 'stats-table';

  const thead = hsTable.createTHead();
  const headerRow = thead.insertRow();
  headerRow.innerHTML = '<th>Lp.</th><th>Gracz</th><th>Najlepszy wynik</th><th>Wygrane</th><th>Partie</th>';

  const tbody = hsTable.createTBody();
  // render all highscores but constrain visible area via CSS
  gameStats.highscores.forEach((hs, idx) => {
    const row = tbody.insertRow();
    const wins = winsMap[hs.nazwa] || 0;
    row.innerHTML = `<td>${idx + 1}</td><td>${hs.nazwa}</td><td><strong>${hs.wynik}</strong></td><td>${wins}</td><td>${hs.ilosc_partii}</td>`;
  });

  hsWrapper.appendChild(hsTable);
  highscoresSection.appendChild(hsWrapper);
  statsBody.appendChild(highscoresSection);
  
  // HISTORIA OSTATNICH PARTII
  const historySection = document.createElement('div');
  historySection.className = 'stats-section';
  
  const histTitle = document.createElement('h3');
  histTitle.innerText = `📜 Historia (${gameStats.gameHistory.length})`;
  historySection.appendChild(histTitle);
  
  const historyDiv = document.createElement('div');
  historyDiv.className = 'history-list';
  
  gameStats.gameHistory.slice(0, 20).forEach((game, idx) => {
    const gameDiv = document.createElement('div');
    gameDiv.className = 'history-item';
    
    const dateSpan = document.createElement('span');
    dateSpan.className = 'history-date';
    dateSpan.innerText = game.date;
    gameDiv.appendChild(dateSpan);
    
    const resultsSpan = document.createElement('span');
    resultsSpan.className = 'history-results';
    resultsSpan.innerText = game.results
      .map((r, i) => `${i + 1}. ${r.nazwa} (${r.wynik})`)
      .join(' | ');
    gameDiv.appendChild(resultsSpan);
    
    historyDiv.appendChild(gameDiv);
  });
  
  historySection.appendChild(historyDiv);
  statsBody.appendChild(historySection);

  // append scrollable body to modal content so footer stays visible
  modalContent.appendChild(statsBody);
  
  // PRZYCISKI
  const buttons = document.createElement('div');
  buttons.className = 'stats-buttons';
  
  const backBtn = document.createElement('button');
  backBtn.innerText = 'Powrót';
  backBtn.onclick = () => {
    modal.remove();
  };
  buttons.appendChild(backBtn);
  
  modalContent.appendChild(buttons);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Pokaż modal - nie dodawaj event listenera na tło aby zapobiec zamknięciu
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

/* =======================
   FLOATING LEFT CONTROLS
   Move `#tura` and `#partia-nr` into a fixed left container so they
   stay visible while scrolling, and reserve space so they never
   overlap the game table.
======================= */
function setupFloatingLeftControls() {
  const tura = document.getElementById('tura');
  const partia = document.getElementById('partia-nr');
  if (!tura || !partia) return;

  // handle title movement: keep reference to original location so we can restore
  const title = document.querySelector('h1');
  if (title && !window.__originalTitlePlace) {
    window.__originalTitlePlace = { parent: title.parentElement, nextSibling: title.nextSibling };
  }

  let container = document.getElementById('left-floating');
  if (!container) {
    container = document.createElement('div');
    container.id = 'left-floating';
    document.body.appendChild(container);
  }

  // Move the elements into the floating container if they aren't already there
  if (tura.parentElement !== container) container.appendChild(tura);
  if (partia.parentElement !== container) container.appendChild(partia);

  // When the main layout is active, add a body class to reserve space
  if (document.querySelector('.layout.aktywna')) {
    document.body.classList.add('left-floating');
    // move title into container above controls so it moves with them
    if (title) {
      // ensure title is not fixed-styled
      title.classList.remove('floating-title');
      if (title.parentElement !== container) container.insertBefore(title, container.firstChild);
    }
  } else {
    document.body.classList.remove('left-floating');
    // restore title to original place if stored
    if (title && window.__originalTitlePlace) {
      const { parent, nextSibling } = window.__originalTitlePlace;
      if (parent && title.parentElement !== parent) parent.insertBefore(title, nextSibling);
    }
  }
}

// Ensure it's set up on load
setupFloatingLeftControls();

// Position the title under the left-floating container so they never overlap
function updateFloatingTitlePosition() {
  const container = document.getElementById('left-floating');
  const title = document.querySelector('h1');
  if (!title) return;

  if (document.body.classList.contains('left-floating') && container) {
    // make title floating and compute top
    title.classList.add('floating-title');
    const crect = container.getBoundingClientRect();
    const top = Math.max(8, Math.round(crect.bottom + 8));
    title.style.top = top + 'px';
  } else {
    // restore title to normal flow
    title.classList.remove('floating-title');
    title.style.top = '';
  }
}

// update on resize/scroll and whenever layout changes
// Debounce helper to avoid flooding on resize/scroll
function debounce(fn, ms) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

const debouncedUpdate = debounce(() => {
  try {
    setupFloatingLeftControls();
    updateFloatingTitlePosition();
  } catch (e) {
    console.error('Floating update error', e);
  }
}, 80);

window.addEventListener('resize', debouncedUpdate);
window.addEventListener('scroll', debouncedUpdate);

// initial position
debouncedUpdate();
