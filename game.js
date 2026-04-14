/* =======================
   GLOBAL VARIABLES
======================= */
let aktywnyGracz = null;
let aktywnaKomorka = null;
let liczbaGraczy = 2;
let nazwyGraczy = new Array(liczbaGraczy).fill("");
let usedPlayerNames = []; // List of nicknames used in the current game
let verifiedPlayersSession = new Set(); // List of verified nicknames in the current session

let generałLicznik = [];
let generałWynik = [];
// Stack for undoing actions
let undoStack = [];
// Number of the current game, used for stats and history
let currentGameNumber = 0;

// SUPABASE
const SUPABASE_URL = 'https://ucxluytjmrbopiwvqpgl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Yd4-7tGatl3FvmG1Y6C9Nw_Yj_nHs3C';

let supabaseClient = null;

// Initialize Supabase
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

// GAME STATS AND HISTORY
let gameStats = {
  totalGames: 0,
  gameHistory: [],
  highscores: []
};

// Load game stats from Supabase
async function loadGameStats() {
  // If Supabase is not initialized, try to initialize it
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
    // Load game counter
    const { data: statsData, error: statsError } = await supabaseClient
      .from('game_stats')
      .select('total_games')
      .eq('id', 1)
      .single();
    
    if (statsError) throw statsError;
    gameStats.totalGames = statsData?.total_games || 0;

    // Load the last 50 games
    const { data: historyData, error: historyError } = await supabaseClient
      .from('game_history')
      .select('date, results')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (historyError) throw historyError;
    gameStats.gameHistory = historyData || [];

    // Load highscores (with PIN for verification)
    const { data: highscoresData, error: highscoresError } = await supabaseClient
      .from('highscores')
      .select('nazwa, wynik, ilosc_partii, pin')
      .order('wynik', { ascending: false });
    
    if (highscoresError) throw highscoresError;
    gameStats.highscores = highscoresData || [];

  } catch (error) {
    console.error('Błąd przy ładowaniu statystyk:', error);
    // Fallback to localStorage if Supabase unavailable
    const saved = localStorage.getItem('kosciGameStats');
    if (saved) {
      gameStats = JSON.parse(saved);
    }
  }
  
  updateGameCounter();
}

// Save game stats to Supabase
async function saveGameStats() {
  if (!supabaseClient) {
    console.warn('Supabase not available, using localStorage only');
    localStorage.setItem('kosciGameStats', JSON.stringify(gameStats));
    updateGameCounter();
    return;
  }

  try {
    // Update game counter
    const { error: updateError } = await supabaseClient
      .from('game_stats')
      .update({ total_games: gameStats.totalGames })
      .eq('id', 1);
    
    if (updateError) throw updateError;
    
    // Save in localStorage as a backup
    localStorage.setItem('kosciGameStats', JSON.stringify(gameStats));
  } catch (error) {
    console.error('Błąd przy zapisie statystyk:', error);
  }
  
  updateGameCounter();
}

// Update the displayed game counter
function updateGameCounter() {
  const counter = document.getElementById('total-games-counter');
  if (counter) {
    counter.innerText = gameStats.totalGames;
  }
}

/* =======================
    FIELD DEFINITION
======================= */
const pola = {
  "Jedynki": gorne(1),
  "Dwójki": gorne(2),
  "Trójki": gorne(3),
  "Czwórki": gorne(4),
  "Piątki": gorne(5),
  "Szóstki": gorne(6),

  "Trzy jednakowe": [0, ...zakres(5, 30, 1)],
  "Cztery jednakowe": [0, ...zakres(5, 30, 1)],
  "Full": [0, 25],
  "Mały strit": [0, 30],
  "Duży strit": [0, 40],
  "Szansa": zakres(5, 30, 1),
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
// Wait for the data to load, then initialize the interface
(async () => {
  await loadGameStats();
  init();
  initPlayerCountButtons();
})();

/* =======================
   INITIALIZATION
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
  
  // Support for 1-0 keys to select the number of players
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
  
  // Clear the table (leave only headers)
  while (tabela.rows.length > 1) {
    tabela.deleteRow(1);
  }
  
  // Add headers for each player
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
      
      // Hover effect - visual cue only
      c.onmouseover = () => {
        if (!c.classList.contains("zablokowane") && g === aktywnyGracz) {
          c.style.opacity = "0.8";
        }
      };
      
      c.onmouseleave = () => {
        c.style.opacity = "1";
      };
      
      // Click - activate edit input
      c.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!c.classList.contains("zablokowane") && g === aktywnyGracz) {
          wybierzPole(pole, g, c);
          // Set focus to the input field after a short delay to ensure it has been rendered
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
    
    // After the Six, add the Top Sum and the Bonus
    if (pole === "Szóstki") {
      // First the bonus, then the top sum (the bonus will be included in the top sum)
      dodajWiersz("Premia");
      dodajWiersz("Suma górna");
    }
  }

  // SUMMARY - Rest
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
   FLOATING ACTION BUTTON (FAB)
======================= */
function initFAB() {
  const fabToggle = document.getElementById('fabToggle');
  const controlsContainer = document.getElementById('controls');

  if (fabToggle && controlsContainer) {
    // Switching the menu with the main button
    fabToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      controlsContainer.classList.toggle('open');
    });

    // Closing the menu if the user clicks outside of it
    document.addEventListener('mousedown', (e) => {
      // Ignore if clicked on the menu itself or the confirmation modal (inline-confirm)
      if (!controlsContainer.contains(e.target) && !e.target.closest('.inline-confirm')) {
        controlsContainer.classList.remove('open');
      }
    });
    
    // Closing the menu after an option is selected (except 'Undo', which has a tooltip next to it)
    const actions = controlsContainer.querySelectorAll('.fab-action');
    actions.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.id !== 'btnUndo' && btn.id !== 'btnNewGame') {
          controlsContainer.classList.remove('open');
        }
      });
    });
  }
}

// Run immediately
initFAB();

/* =======================
   START STAGES - WITH DRAG & DROP MODIFICATIONS
======================= */

// Check if the name is base (Player 1, Player 2, etc.)
function isDefaultPlayerName(name) {
  return /^Gracz \d+$/i.test(name.trim());
}

function updatePlayerLabels() {
  const rows = document.querySelectorAll('.nazwa-input');
  liczbaGraczy = rows.length; // Update the global number of players
  
  // Rebuild the array based on the physical order in the DOM
  nazwyGraczy = Array.from(rows).map((row, index) => {
    // Update the labels to always be in order (Player 1, Player 2...)
    const label = row.querySelector('.player-label');
    if (label) label.innerText = `Gracz ${index + 1}: `;
    
    // Update the array
    const input = row.querySelector('input[type="text"]');
    return input ? input.value.trim() : "";
  });
}

function etapNazwy() {
  document.getElementById("etap-liczba").style.display = "none";
  document.getElementById("etap-nazwy").style.display = "block";
  
  const inputsDiv = document.getElementById("nazwa-inputs");
  inputsDiv.innerHTML = "";
  
  nazwyGraczy = new Array(liczbaGraczy).fill("");
  usedPlayerNames = []; // Reset the list of used names
  
  const registeredPlayersArray = (gameStats.highscores || [])
    .map(hs => hs.nazwa)
    .sort((a, b) => a.localeCompare(b, 'pl'));
  
  // Generate the initial rows
  for (let g = 0; g < liczbaGraczy; g++) {
    inputsDiv.appendChild(createPlayerRow(registeredPlayersArray));
  }
  updatePlayerLabels();
  setupDragAndDrop(inputsDiv);

  // Add the "Plus" button at the bottom (if it doesn't exist yet)
  let actionContainer = document.getElementById("etap-nazwy-actions");
  if (!actionContainer) {
    actionContainer = document.createElement("div");
    actionContainer.id = "etap-nazwy-actions";
    actionContainer.className = "etap-actions-wrapper";

    const addBtn = document.createElement("button");
    addBtn.innerHTML = `Dodaj gracza <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;    addBtn.title = "Dodaj kolejnego gracza na koniec listy";
    addBtn.className = "btn-add-player";
    addBtn.type = "button";
    addBtn.onclick = (e) => {
      e.preventDefault();
      inputsDiv.appendChild(createPlayerRow(registeredPlayersArray));
      updatePlayerLabels();
    };
    
    const etapNazwyDiv = document.getElementById("etap-nazwy");
    const dalejBtn = etapNazwyDiv.querySelector('button[onclick="validateAndProceedToStart()"]');
    
    // Fold the strip at the bottom
    etapNazwyDiv.insertBefore(actionContainer, dalejBtn);
    actionContainer.appendChild(dalejBtn);
    actionContainer.appendChild(addBtn);   
  } else {
    actionContainer.style.display = "flex";
  }
  document.addEventListener('click', handleClickOutside, true);
  
  // Set focus on the first input
  setTimeout(() => {
    const firstInput = inputsDiv.querySelector('input');
    if (firstInput) firstInput.focus();
  }, 0);
}

// Creates a single player row with drag and drop functionality and a minus button
// Creates a single player row
function createPlayerRow(registeredPlayersArray) {
  const div = document.createElement("div");
  div.className = "nazwa-input";

  div.addEventListener('dragstart', () => {
    div.classList.add('dragging');
    document.querySelectorAll('.nazwa-input-dropdown.aktywny').forEach(d => d.classList.remove('aktywny'));
  });
  
  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    div.draggable = false; // Disable dragging after dropping
    updatePlayerLabels(); 
  });

  const dragHandle = document.createElement("div");
  dragHandle.className = "drag-handle";
  dragHandle.innerHTML = "⠿";
  
  // Enable dragging when clicking the mouse/touching the row...
  div.addEventListener('mousedown', (e) => {
    // ...UNLESS you click on the input field, buttons, or the dropdown!
    const isInteractive = e.target.closest('input, button, .nazwa-input-dropdown');
    if (!isInteractive) {
      div.draggable = true;
    }
  });
  
  // Disable dragging after releasing the mouse button, to prevent blocking the interface
  div.addEventListener('mouseup', () => {
    div.draggable = false;
  });

  const label = document.createElement("label");
  label.className = "player-label";

  const inputContainer = document.createElement("div");
  inputContainer.className = "nazwa-input-container";

  // Required previous declaration of dropdown for filtering
  const dropdownBtn = document.createElement("button");
  dropdownBtn.className = "nazwa-input-dropdown-btn";
  dropdownBtn.innerText = "▼";
  dropdownBtn.type = "button";
  
  const dropdown = document.createElement("div");
  dropdown.className = "nazwa-input-dropdown";
  
  const input = document.createElement("input");
  input.type = "text";
  input.value = "";
  input.placeholder = `Wpisz nick`;
  
  let lastValidName = ""; 
  
  // Build the list items
  registeredPlayersArray.forEach(playerName => {
    const item = document.createElement("div");
    item.className = "nazwa-input-dropdown-item";
    item.innerText = playerName;
    item.dataset.name = playerName;
    item.onclick = async (e) => {
      e.stopPropagation();
      dropdown.classList.remove("aktywny"); // Close the dropdown immediately
      
      updatePlayerLabels();
      
      if (usedPlayerNames.includes(playerName) && lastValidName !== playerName) {
        showPINTooltip(input, '❌ Nick już wybrany!', 'error', 1500);
        return;
      }
      
      // Check in the session
      if (!verifiedPlayersSession.has(playerName)) {
        const pinResult = await showInlinePINDialog(playerName, true);
        if (pinResult.cancelled) return;
        
        const pinValid = await verifyPlayerPIN(playerName, pinResult.pin);
        if (!pinValid) {
          showPINTooltip(input, '❌ Nieprawidłowy PIN!', 'error', 1500);
          return;
        }
        verifiedPlayersSession.add(playerName); // Save to session
      }
      
      if (lastValidName && usedPlayerNames.includes(lastValidName)) {
        usedPlayerNames = usedPlayerNames.filter(n => n !== lastValidName);
      }
      
      input.value = playerName;
      usedPlayerNames.push(playerName);
      lastValidName = playerName;
      updatePlayerLabels();
      showPINTooltip(input, '✅ Zalogowano!', 'success', 1000);
      focusNextElementAfter(input); // Auto skip to the end
    };
    dropdown.appendChild(item);
  });
  
  // 1. Common filter function (hides used nicknames and those that do not match the entered phrase)
  const filterDropdownItems = () => {
    const filterText = input.value.trim().toLowerCase();
    const items = dropdown.querySelectorAll('.nazwa-input-dropdown-item');
    let hasVisible = false;

    items.forEach(item => {
      const name = item.innerText; // We get the player's name from the element
      // We check: whether it matches the text AND whether it is not already taken by someone else in this session
      const isAlreadyUsed = usedPlayerNames.includes(name) && name !== lastValidName;
      const matchesFilter = name.toLowerCase().includes(filterText);

      if (matchesFilter && !isAlreadyUsed) {
        item.style.display = '';
        hasVisible = true;
      } else {
        item.style.display = 'none';
      }
    });
    return hasVisible;
  };

  // 2. Handling text input
  input.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    
    // Freeing the name from the 'used' list, if the user starts editing it
    if (lastValidName && lastValidName !== val && usedPlayerNames.includes(lastValidName)) {
        usedPlayerNames = usedPlayerNames.filter(n => n !== lastValidName);
        lastValidName = "";
    }

    const hasVisible = filterDropdownItems(); // Refresh the visibility of elements

    // Automatically show the list when something is typed and there are matching players
    if (val.length > 0 && hasVisible) {
      document.querySelectorAll('.nazwa-input-dropdown.aktywny').forEach(d => {
        if (d !== dropdown) d.classList.remove('aktywny');
      });
      dropdown.classList.add("aktywny");
    } else {
      dropdown.classList.remove("aktywny");
    }
  });

  // 3. Handling click and focus (shows suggestions immediately, if there is text in the field)
  const showDropdownIfHasText = () => {
    const hasVisible = filterDropdownItems();
    if (input.value.trim().length > 0 && hasVisible) {
      document.querySelectorAll('.nazwa-input-dropdown.aktywny').forEach(d => {
        if (d !== dropdown) d.classList.remove('aktywny');
      });
      dropdown.classList.add("aktywny");
    }
  };

  input.addEventListener('click', showDropdownIfHasText);
  input.addEventListener('focus', showDropdownIfHasText);
  
  // Main confirmation with Enter key or auto-completion with Tab
  input.onkeydown = async (e) => {
    
    // TAB KEY LOGIC (Autocomplete)
    if (e.key === 'Tab') {
      // Find all visible items in the list
      const visibleItems = Array.from(dropdown.querySelectorAll('.nazwa-input-dropdown-item'))
                                .filter(item => item.style.display !== 'none');
      
      // If the list is open and there is exactly one option available
      if (dropdown.classList.contains("aktywny") && visibleItems.length === 1) {
        e.preventDefault(); // Block the default tab navigation to the next field
        visibleItems[0].click(); // Simulate a click on this single item (will trigger PIN and login)
        return;
      }
    }

    // ENTER KEY LOGIC (Standard Confirmation)
    if (e.key === 'Enter') {
      e.preventDefault();
      const newName = input.value.trim();
      
      if (!newName) {
        showPINTooltip(input, '❌ Wprowadź nick!', 'error', 1500);
        return;
      }
      if (isDefaultPlayerName(newName)) {
        showPINTooltip(input, '❌ Wybierz unikalny nick!', 'error', 1500);
        return;
      }
      
      updatePlayerLabels(); 
      
      const nameCount = nazwyGraczy.filter(n => n === newName).length;
      if (nameCount > 1 || (usedPlayerNames.includes(newName) && lastValidName !== newName)) {
        showPINTooltip(input, '❌ Nick wybrano już!', 'error', 1500);
        return;
      }
      
      const isExistingPlayer = registeredPlayersArray.includes(newName);
      
      if (isExistingPlayer) {
        if (!verifiedPlayersSession.has(newName)) {
          const pinResult = await showInlinePINDialog(newName, true);
          if (pinResult.cancelled) return;
          const pinValid = await verifyPlayerPIN(newName, pinResult.pin);
          if (!pinValid) {
            showPINTooltip(input, '❌ Nieprawidłowy PIN!', 'error', 1500);
            return;
          }
          verifiedPlayersSession.add(newName);
        }
        if(lastValidName) usedPlayerNames = usedPlayerNames.filter(n => n !== lastValidName);
        usedPlayerNames.push(newName);
        lastValidName = newName;
        showPINTooltip(input, '✅ Zalogowano!', 'success', 1000);
      } else {
        if (!verifiedPlayersSession.has(newName)) {
          const pinResult = await showInlinePINDialog(newName, false);
          if (pinResult.cancelled) return;
          const saved = await createNewPlayerWithPIN(newName, pinResult.pin);
          if (!saved) {
            showPINTooltip(input, '❌ Błąd zapisu!', 'error', 1500);
            return;
          }
          verifiedPlayersSession.add(newName);
        }
        if(lastValidName) usedPlayerNames = usedPlayerNames.filter(n => n !== lastValidName);
        usedPlayerNames.push(newName);
        lastValidName = newName;
        showPINTooltip(input, '✅ Zarejestrowano!', 'success', 1000);
      }
      
      input.value = newName;
      updatePlayerLabels();
      dropdown.classList.remove("aktywny"); // Close after using Enter
      focusNextElementAfter(input); 
    }
  };
  
  // ARROW CLICK LOGIC
  dropdownBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Filter based on what has been typed, before opening
    const filterText = input.value.trim().toLowerCase();
    const items = dropdown.querySelectorAll('.nazwa-input-dropdown-item');
    items.forEach(item => {
      if (item.innerText.toLowerCase().includes(filterText)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });

    document.querySelectorAll('.nazwa-input-dropdown.aktywny').forEach(d => {
        if(d !== dropdown) d.classList.remove('aktywny');
    });
    dropdown.classList.toggle("aktywny");
  };
  
  inputContainer.addEventListener("click", (e) => e.stopPropagation());
  inputContainer.appendChild(input);
  if (registeredPlayersArray.length > 0) {
    inputContainer.appendChild(dropdownBtn);
  }
  inputContainer.appendChild(dropdown);

  // Button with precise vector minus
  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-remove-player";
  removeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  removeBtn.title = "Usuń gracza";
  removeBtn.type = "button";
  removeBtn.onclick = () => {
     const rows = document.querySelectorAll('.nazwa-input');
     if (rows.length <= 1) {
        showCenterTooltip("Gra wymaga minimum 1 gracza!", "error", 2000);
        return;
     }
     if (lastValidName && usedPlayerNames.includes(lastValidName)) {
         usedPlayerNames = usedPlayerNames.filter(n => n !== lastValidName);
     }
     div.remove();
     updatePlayerLabels();
  };

  div.appendChild(dragHandle);
  div.appendChild(label);
  div.appendChild(inputContainer);
  div.appendChild(removeBtn);
  
  return div;
}

// Drag & Drop container logic
function setupDragAndDrop(container) {
  container.addEventListener('dragover', e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(container, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (draggable) {
      if (afterElement == null) {
        container.appendChild(draggable);
      } else {
        container.insertBefore(draggable, afterElement);
      }
    }
  });
}

// Finds the element over which the mouse is positioned when dropping
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.nazwa-input:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Inline message above the input
function showPINTooltip(inputElement, message, type = 'error', duration = 1500) {
  // Remove the existing tooltip
  const existing = document.querySelector('.pin-tooltip');
  if (existing) existing.remove();
  
  // Calculate the position BEFORE adding to the DOM
  const rect = inputElement.getBoundingClientRect();
  const tooltip = document.createElement('div');
  tooltip.className = `pin-tooltip pin-tooltip-${type}`;
  tooltip.innerText = message;
  tooltip.style.visibility = 'hidden';
  document.body.appendChild(tooltip);

  const tooltipWidth = tooltip.offsetWidth;
  const tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
  const tooltipTop = rect.top - 40;
  
  tooltip.style.visibility = 'visible';
  tooltip.style.left = tooltipLeft + 'px';
  tooltip.style.top = tooltipTop + 'px';
  
  if (duration > 0) {
    setTimeout(() => tooltip.remove(), duration);
  }
}

// Tooltip in the middle of the screen for global messages
function showCenterTooltip(message, type = 'error', duration = 2500) {
  // Remove the existing tooltip
  const existing = document.querySelector('.center-tooltip');
  if (existing) existing.remove();
  
  const tooltip = document.createElement('div');
  tooltip.className = `center-tooltip center-tooltip-${type}`;
  tooltip.innerText = message;
  tooltip.style.opacity = '0';
  
  document.body.appendChild(tooltip);
  
  // Show tooltip after adding to DOM
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
  // Remove the existing message
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
// New, improved Inline PIN dialog (4 columns)
async function showInlinePINDialog(playerName, isExisting) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pin-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 2500; backdrop-filter: blur(3px);';
    
    // Close on background click
    overlay.onmousedown = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve({ pin: null, cancelled: true });
      }
    };
    
    const box = document.createElement('div');
    box.style.cssText = 'background: white; padding: 30px; border-radius: 12px; text-align: center; min-width: 320px; box-shadow: 0 10px 40px rgba(0,0,0,0.25); animation: fadeIn 0.2s ease-out;';
    
    const title = document.createElement('h3');
    title.innerText = isExisting ? '🔐 Wprowadź PIN' : '🔐 Ustaw PIN';
    title.style.cssText = 'margin: 0 0 10px 0; color: #2c3e50; font-size: 1.6em;';
    box.appendChild(title);
    
    const nameSpan = document.createElement('p');
    nameSpan.innerText = playerName;
    nameSpan.style.cssText = 'font-size: 1.2em; color: #1976d2; margin: 0 0 25px 0; font-weight: bold;';
    box.appendChild(nameSpan);
    
    // Container for the 4 columns
    const inputsContainer = document.createElement('div');
    inputsContainer.style.cssText = 'display: flex; gap: 12px; justify-content: center; margin-bottom: 25px;';
    
    const inputs = [];
    let pinCode = ['', '', '', '']; 

    for (let i = 0; i < 4; i++) {
      const input = document.createElement('input');
      input.type = 'tel'; 
      input.maxLength = 1;
      
      input.style.cssText = 'width: 50px; height: 60px; font-size: 32px; font-family: monospace; text-align: center; border: 2px solid #ddd; border-radius: 8px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s; background: white; color: black;';
      
      input.onfocus = () => {
        input.style.borderColor = '#2196f3';
        input.style.boxShadow = '0 0 8px rgba(33, 150, 243, 0.3)';
        input.value = ''; 
        pinCode[i] = '';
      };
      
      input.onblur = () => {
        input.style.borderColor = '#ddd';
        input.style.boxShadow = 'none';
      };
      
      input.oninput = (e) => {
        const char = input.value.replace(/[^0-9]/g, '');
        
        if (char.length === 1) {
          pinCode[i] = char;          
          input.value = '•';          
          
          if (i < 3) {
            inputs[i + 1].focus();
          } else {
            submitPin();
          }
        } else {
          input.value = '';
          pinCode[i] = '';
        }
      };
      
      input.onkeydown = (e) => {
        if (e.key === 'Backspace' && input.value === '' && i > 0) {
          inputs[i - 1].focus();
          inputs[i - 1].value = '';
          pinCode[i - 1] = '';
        }
        if (e.key === 'Escape') {
          overlay.remove();
          resolve({ pin: null, cancelled: true });
        }
      };
      
      inputsContainer.appendChild(input);
      inputs.push(input);
    }
    box.appendChild(inputsContainer);
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    setTimeout(() => inputs[0].focus(), 50);
    
    function submitPin() {
      const pin = pinCode.join(''); 
      if (pin.length === 4) {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          resolve({ pin, cancelled: false });
        }, 150);
      }
    }
  });
}

// Helper function: Jumps to the next player or the 'Next' button
function focusNextElementAfter(currentInput) {
  setTimeout(() => {
    const allInputs = Array.from(document.getElementById("nazwa-inputs").querySelectorAll('input[type="text"]'));
    const currentIndex = allInputs.indexOf(currentInput);
    if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
      allInputs[currentIndex + 1].focus();
    } else {
      const dalejBtn = document.querySelector('#etap-nazwy button[onclick="validateAndProceedToStart()"]');
      if (dalejBtn) dalejBtn.focus();
    }
  }, 100);
}

// Validate all player names and ensure they have a PIN (considering sessions)
async function validateAndProceedToStart() {
  updatePlayerLabels();

  for (let i = 0; i < liczbaGraczy; i++) {
    const playerName = nazwyGraczy[i];
    if (!playerName || playerName.trim() === '') {
      showCenterTooltip(`Gracz ${i + 1}: Wprowadź nick przed przejściem dalej!`, 'error', 2500);
      return;
    }
    if (isDefaultPlayerName(playerName)) {
      showCenterTooltip(`Gracz ${i + 1}: Wybierz unikalny nick zamiast "${playerName}"!`, 'error', 2500);
      return;
    }
  }
  
  const registeredPlayersArray = (gameStats.highscores || [])
    .map(hs => hs.nazwa)
    .sort((a, b) => a.localeCompare(b, 'pl'));
  
  for (let i = 0; i < liczbaGraczy; i++) {
    const playerName = nazwyGraczy[i];
    
    if (!usedPlayerNames.includes(playerName)) {
      const isExisting = registeredPlayersArray.includes(playerName);
      
      if (isExisting) {
        if (!verifiedPlayersSession.has(playerName)) {
          const pinResult = await showInlinePINDialog(playerName, true);
          if (pinResult.cancelled) return; 
          
          const pinValid = await verifyPlayerPIN(playerName, pinResult.pin);
          if (!pinValid) {
            showCenterTooltip('Nieprawidłowy PIN dla gracza: ' + playerName, 'error', 2500);
            return; 
          }
          verifiedPlayersSession.add(playerName);
        }
        usedPlayerNames.push(playerName);
      } else {
        if (!verifiedPlayersSession.has(playerName)) {
          const pinResult = await showInlinePINDialog(playerName, false);
          if (pinResult.cancelled) return; 
          
          const saved = await createNewPlayerWithPIN(playerName, pinResult.pin);
          if (!saved) {
            showCenterTooltip('Błąd przy zapisywaniu gracza: ' + playerName, 'error', 2500);
            return; 
          }
          verifiedPlayersSession.add(playerName);
        }
        usedPlayerNames.push(playerName);
      }
    }
  }
  
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

  const startBtn = document.querySelector('#etap-start button[onclick="startGry()"]');
  if (startBtn) {
    setTimeout(() => startBtn.focus(), 50);
  }
}

  // Enter support on the starting player selection screen
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  if (e.key === 'Enter') {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
      e.preventDefault();
      document.activeElement.click();
      return;
    }

    const startContainer = document.getElementById("start");
    const etapStart = document.getElementById("etap-start");
    
    if (startContainer && startContainer.style.display !== "none" && 
        etapStart && etapStart.style.display !== "none") {
      e.preventDefault();
      startGry();
    }
  }
});

/* =======================
   GAME START
======================= */
function startGry() {
  // Restart the game state
  generałLicznik = new Array(liczbaGraczy).fill(0);
  generałWynik = new Array(liczbaGraczy).fill(0);
  
  // Set number of current game based on stats
  currentGameNumber = gameStats.totalGames + 1;
  
  // If the player didn't choose a specific starting player, randomly select one
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
   ROUND
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
   ROUND SELECTION
======================= */
function wybierzPole(pole, gracz, komorka) {
  if (gracz !== aktywnyGracz) return;
  if (komorka.classList.contains("zablokowane")) return;

  const panel = document.getElementById("panel");
  
  // If the panel is already open for this cell, just close it. If it's open for another cell, switch immediately without closing animation.
  if (panel.classList.contains("aktywny")) {
    // Clear options and hide panel immediately for a smoother transition when switching between cells
    document.getElementById("opcje").innerHTML = "";
    panel.classList.remove("aktywny");
    // Wait a moment for the panel to hide before opening the new one, to avoid visual glitches
    setTimeout(() => {
      openPanel(pole, gracz, komorka);
    }, 210);
  } else {
    // If the panel is not open, just open it immediately
    openPanel(pole, gracz, komorka);
  }
}

function openPanel(pole, gracz, komorka) {
  aktywnaKomorka = { pole, gracz, komorka };
  const panel = document.getElementById("panel");
  
  document.getElementById("opis").innerText =
    `${pole} – ${nazwyGraczy[gracz]}`;

  renderOpcje(pole);
  
  // Render the panel first, then position it, to ensure correct dimensions for positioning calculations
  setTimeout(() => {
    // Position panel when content is already rendered
    positionPanelNearCell(komorka);
    
    // Add active class after a short delay to allow CSS transitions (like fade-in) to work smoothly
    panel.classList.add("aktywny");
    document.body.classList.add("no-scroll"); // Optional: prevent background scrolling when panel is open
    
    const input = document.querySelector(".input-liczby input");
    if (input) {
      input.value = "";
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        input.focus();
        input.select();
      }
    }
  }, 50);
}

// Set the panel's position near the clicked cell, adjusting to stay within the viewport
function positionPanelNearCell(komorka) {
  const panel = document.getElementById('panel');
  if (!komorka || !panel) return;
  
  const crect = komorka.getBoundingClientRect();
  const prect = panel.getBoundingClientRect();
  const margin = 8;
  let left = crect.right + margin;
  
  // if the panel would go off the right edge of the window, position it to the left of the cell instead
  if (left + prect.width > window.innerWidth - margin) {
    left = crect.left - prect.width - margin;
  }
  if (left < margin) left = margin;

  // Align vertically relative to the cell, but keep within the window
  let top = crect.top;
  if (top + prect.height > window.innerHeight - margin) {
    top = window.innerHeight - prect.height - margin;
  }
  if (top < margin) top = margin;

  panel.style.left = Math.round(left) + 'px';
  panel.style.top = Math.round(top) + 'px';
}

/* =======================
   OPTIONS RENDERING
======================= */
function renderOpcje(pole) {
  const box = document.getElementById("opcje");
  box.innerHTML = "";

  // Add input field for manual entry with validation
  const inputDiv = document.createElement("div");
  inputDiv.className = "input-liczby";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "50";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*"; 
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
      document.body.classList.remove("no-scroll");
      document.getElementById("opcje").innerHTML = "";
      aktywnaKomorka = null;
    }
  };
  
  inputDiv.appendChild(input);
  box.appendChild(inputDiv);

  // Options buttons
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

  // Live filtering of options based on input
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

// Close the panel when clicking outside of it or the active cell
document.addEventListener('mousedown', (e) => {
  const panel = document.getElementById('panel');
  if (!panel) return;
  
  // Don't close the panel when I click on the game cell (onclick will open a new one)
  if (e.target.closest('td.pole-gry')) {
    return;
  }
  
  if (aktywnaKomorka && panel.classList.contains('aktywny')) {
    const { komorka } = aktywnaKomorka;
    // If I click outside the panel and the active cell, close the panel
    if (!panel.contains(e.target) && !komorka.contains(e.target)) {
      panel.classList.remove('aktywny');
      document.body.classList.remove("no-scroll")
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
  const { 
    cell, 
    oldText, 
    oldLocked, 
    prevGenerałLicznik, 
    prevGenerałWynik, 
    prevActiveGracz, 
    prevGeneralText, 
    prevGeneralLocked,
    gracz 
  } = snap;

  // 1. Restore the state of the clicked cell
  if (cell) {
    cell.innerText = oldText;
    if (oldLocked) cell.classList.add('zablokowane'); 
    else cell.classList.remove('zablokowane');
  }

  // 2. Restore the Generał state (in case it was changed by the last action)
  if (prevGenerałLicznik) generałLicznik = prevGenerałLicznik.slice();
  if (prevGenerałWynik) generałWynik = prevGenerałWynik.slice();
  
  // 3. Restore the appearance of the Generał cell (fixes the issue with the disappearing 0)
  if (gracz !== undefined) {
    const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
    if (generalRow) {
      const generalCell = generalRow.cells[gracz + 1];
      if (generalCell) {
        generalCell.innerText = prevGeneralText;
        if (prevGeneralLocked) {
          generalCell.classList.add('zablokowane');
        } else {
          generalCell.classList.remove('zablokowane');
        }
      }
    }
  }
  
  aktywnyGracz = prevActiveGracz;
  przeliczSumy();
  aktualizujTure();
}

// Handler for the "Undo" button, with confirmation if there are actions to undo
function requestUndo(targetEl) {
  if (undoStack.length === 0) {
    if (targetEl) showInlineConfirmNear(targetEl, 'Brak akcji do cofnięcia.', () => {}, () => {});
    else showInlineConfirm('Brak akcji do cofnięcia.', () => {}, () => {});
    return;
  }
  if (targetEl) showInlineConfirmNear(targetEl, 'Cofnąć ostatnią akcję?', () => undoLast(), () => {});
  else showInlineConfirm('Cofnąć ostatnią akcję?', () => undoLast(), () => {});
}

// Reset the game - after confirmation
function resetGame() {
  // show the start screen and reset the states
  // show the start screen and set it to the first stage of player count selection
  document.getElementById('start').style.display = 'block';
  document.getElementById('etap-liczba').style.display = 'block';
  document.getElementById('etap-nazwy').style.display = 'none';
  document.getElementById('etap-start').style.display = 'none';
  
  // Hide game elements
  document.getElementById("tura").classList.remove("aktywna");
  document.getElementById("partia-nr").classList.remove("aktywna");
  document.getElementById("partia-nr").innerText = "";
  document.querySelector(".layout").classList.remove("aktywna");
  document.getElementById("controls").classList.remove("aktywna");
  
  const tabela = document.getElementById('tabela');
  // delete all rows except the header
  while (tabela.rows.length > 1) tabela.deleteRow(1);
  // restore the header
  const headerRow = tabela.rows[0];
  while (headerRow.cells.length > 1) headerRow.deleteCell(1);
  // reset data
  aktywnyGracz = null;
  // clear any existing names so the user can choose new ones (keep the number of players)
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

// Handle Ctrl+Z (undo)
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

// Shows a nice notification about an error (e.g., invalid value)
function showErrorNotification(message) {
  // Remove the existing notification if it exists
  const existing = document.querySelector('.error-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'error-notification';
  
  const content = document.createElement('div');
  content.className = 'error-content';
  content.innerHTML = `⚠️ ${message}`;
  notification.appendChild(content);
  
  document.body.appendChild(notification);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
  
  // Clicking on the notification closes it
  notification.onclick = () => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  };
}

// Shows an internal confirmation in the panel (doesn't use alert/confirm)
function showInlineConfirm(message, onYes, onNo) {
  // remove existing global confirmations
  const existing = document.body.querySelector('.inline-confirm.global-fixed');
  if (existing) existing.remove();
  const existingOverlay = document.body.querySelector('.confirm-overlay');
  if (existingOverlay) existingOverlay.remove();

  // Add overlay - background that will block interactions with the game
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
    // Clicking on the overlay = answer "No"
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

  // Position in the center of the screen
  const brect = box.getBoundingClientRect();
  const left = (window.innerWidth - brect.width) / 2;
  const top = (window.innerHeight - brect.height) / 2;

  box.style.left = Math.round(left) + 'px';
  box.style.top = Math.round(top) + 'px';

  // Auto-focus "Tak" button and allow Enter to confirm it
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

// Shows a confirmation near a given element (e.g., a button)
function showInlineConfirmNear(targetEl, message, onYes, onNo) {
  // remove existing global confirmations
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

  // Position near the target element
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

  // Auto-focus "Tak" button and allow Enter to confirm it
  setTimeout(() => {
    yes.focus();
  }, 0);

  // Handle Enter to confirm (clicking "Tak")
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
   SAVE SELECTION / END TURN
======================= */
function zapisz(wartosc) {
  let { pole, gracz, komorka } = aktywnaKomorka;
  let wynik = wartosc;

  // Map for upper section fields to their base values (e.g., "Trójki" -> 3) for easier bonus calculations
  const mapaWartosciGorne = { 
    "Jedynki": 1, "Dwójki": 2, "Trójki": 3, "Czwórki": 4, "Piątki": 5, "Szóstki": 6 
  };

  function createSnapshot() {
    // We retrieve the current state of the General cell for this player so that we can restore it
    const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
    const generalCell = generalRow ? generalRow.cells[gracz + 1] : null;

    return {
      pole,
      gracz,
      cell: komorka,
      oldText: komorka.innerText,
      oldLocked: komorka.classList.contains('zablokowane'),
      // Same for the General cell, we need to save its state because it can be modified by the bonus logic
      prevGeneralText: generalCell ? generalCell.innerText : '',
      prevGeneralLocked: generalCell ? generalCell.classList.contains('zablokowane') : false,
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
    document.body.classList.remove("no-scroll");
    document.getElementById("opcje").innerHTML = "";

    przeliczSumy();

    aktywnyGracz = (aktywnyGracz + 1) % liczbaGraczy;
    aktualizujTure();
    
    setTimeout(() => checkGameEnd(), 100);
  }

  // GENERAŁ - set to 50 points if it's the first time, otherwise add 100 points for each subsequent General
  if (pole === "Generał" && wartosc === 50) {
    const snap = createSnapshot();
    if (generałLicznik[gracz] === 0) {
      generałWynik[gracz] = 50;
      generałLicznik[gracz] = 1;
    } else {
      generałWynik[gracz] += 100;
    }
    wynik = generałWynik[gracz];
    
    const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
    if (generalRow) {
      const generalCell = generalRow.cells[gracz + 1];
      if (generalCell) generalCell.innerText = generałWynik[gracz];
    }
    undoStack.push(snap);
    finishSave();
    return;
  }
  
  // BONUS LOGIC +100 (Further Generals on other fields)
  const polaZGeneralem = ["Jedynki", "Dwójki", "Trójki", "Czwórki", "Piątki", "Szóstki",
                          "Trzy jednakowe", "Cztery jednakowe", "Full", "Mały strit", "Duży strit", "Szansa"];

  // The +100 bonus is only available if the General field already has a value of 50 (not 0)
  if (generałLicznik[gracz] > 0 && generałWynik[gracz] >= 50 && pole !== "Generał" && polaZGeneralem.includes(pole)) {
    
    const polesWith5OfAKind = ["Szansa", "Trzy jednakowe", "Cztery jednakowe"];
    let needsConfirm = false;
    let confirmMessage = 'Czy to jest generał (5 jednakowych)?\nDodać +100 do głównego generała?';
    let autoAddBonus = false;

    // Fix: Check fields 1-6. Value must be exactly 5 * field digit
    if (mapaWartosciGorne[pole]) {
      const wymaganaWartosc = 5 * mapaWartosciGorne[pole];
      if (wartosc === wymaganaWartosc) {
        autoAddBonus = true; // For upper section fields, we automatically add the bonus for the correct value
      } else if (wartosc === 0) {
        needsConfirm = true; // If we're crossing out a field with an active general, we ask for the bonus
      }
    } 
    // Lower section fields (Szansa, 3 alike, 4 alike) - check multiples [5,10,15,20,25,30]
    else if (polesWith5OfAKind.includes(pole) && [5, 10, 15, 20, 25, 30].includes(wartosc)) {
      needsConfirm = true;
    } 
    // Other fields (Strike, Full) - if the value is the maximum for the field, we ask for a bonus
    else if (!polesWith5OfAKind.includes(pole) && !mapaWartosciGorne[pole]) {
      const maxValue = Math.max(...pola[pole]);
      if (wartosc === maxValue && wartosc > 0) {
        needsConfirm = true;
      }
    }

    if (autoAddBonus) {
      const snap = createSnapshot();
      generałWynik[gracz] += 100;
      const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
      if (generalRow) {
        const generalCell = generalRow.cells[gracz + 1];
        if (generalCell) {
          generalCell.innerText = generałWynik[gracz];
          generalCell.classList.add("zablokowane");
        }
      }
      undoStack.push(snap);
      finishSave();
      return;
    }

    if (needsConfirm) {
      showInlineConfirm(confirmMessage, () => {
        const snap = createSnapshot();
        generałWynik[gracz] += 100;
        const generalRow = document.querySelector(`tr[data-pole="Generał"]`);
        if (generalRow) {
          const generalCell = generalRow.cells[gracz + 1];
          if (generalCell) {
            generalCell.innerText = generałWynik[gracz];
            generalCell.classList.add("zablokowane");
          }
        }
        undoStack.push(snap);
        finishSave();
      }, () => {
        const snap = createSnapshot();
        undoStack.push(snap);
        finishSave();
      });
      return;
    }
  }

  // Standard save for any field without bonus implications
  const snap = createSnapshot();
  undoStack.push(snap);
  finishSave();
}

/* =======================
   SUM and BONUS CALCULATIONS
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
    // Bonus visible above the top total but included in the top total
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
   GAME END CHECK
======================= */
function checkGameEnd() {
  const tabela = document.getElementById("tabela");
  
  // Check if all fields (except sums) are blocked for all players
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
    
    if (!allFilled) return; // Game is not over yet
  }
  
  // All fields filled - show results
  showGameEndModal();
}

function showGameEndModal() {
  // Collect final results
  const results = [];
  for (let g = 0; g < liczbaGraczy; g++) {
    const razem = document.querySelector(`tr[data-sum="RAZEM"]`).cells[g + 1].innerText;
    results.push({
      gracz: g,
      nazwa: nazwyGraczy[g],
      wynik: parseInt(razem) || 0
    });
  }
  
  // Sort results by score descending
  results.sort((a, b) => b.wynik - a.wynik);
  
  // SAVE RESULTS TO SUPABASE AND LOCALLY
  (async () => {
    try {
      // Add game to history
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

      // Update highscores
      for (const result of results) {
        const { data: existing, error: selectError } = await supabaseClient
          .from('highscores')
          .select('*')
          .eq('nazwa', result.nazwa)
          .maybeSingle();

        if (selectError) throw selectError;

        if (existing) {
          // Player exists - update if score is higher
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
          // New player
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

      // Increase game counter
      gameStats.totalGames++;
      const { error: statsError } = await supabaseClient
        .from('game_stats')
        .update({ total_games: gameStats.totalGames })
        .eq('id', 1);
      
      if (statsError) throw statsError;

      // Load updated data
      await loadGameStats();

    } catch (error) {
      console.error('Błąd przy zapisie wyniku:', error);
      showCenterTooltip('Błąd przy zapisie wyniku. Spróbuj ponownie.', 'error', 3000);
      return;
    }

    showGameEndModalUI(results);
  })();
}

// Function to properly inflect the word "punkt/punkty/punktów"
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


// Function to verify PIN for an existing player
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

// Function to create a new player with a PIN
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
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'game-end-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'game-end-content';
  
  const title = document.createElement('h2');
  title.innerText = '🎉 Koniec gry!';
  modalContent.appendChild(title);
  
  // Game stats summary
  const statsDiv = document.createElement('div');
  statsDiv.className = 'game-stats-summary';
  const totalGamesText = document.createElement('p');
  totalGamesText.innerHTML = `<strong>Zakończono partię:</strong> ${gameStats.totalGames}`;
  statsDiv.appendChild(totalGamesText);
  modalContent.appendChild(statsDiv);
  
  // Tiebreaker Handling - Find all players with the highest score
  const maxScore = results[0].wynik;
  const winners = results.filter(r => r.wynik === maxScore);
  const runnerUp = results.find(r => r.wynik < maxScore);
  
  const resultText = document.createElement('p');
  resultText.className = 'game-end-result';
  
  if (winners.length > 1) {
    // Tie
    const winnerNames = winners.map(w => w.nazwa).join(', ');
    const punktForm = getPunktForm(maxScore);
    resultText.innerHTML = `🤝 <strong>REMIS!</strong><br><strong>${winnerNames}</strong><br>wszyscy mają <strong>${maxScore}</strong> ${punktForm}`;
  } else {
    // One person won
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
  
  // (Button "Zagraj ponownie" removed - use now the "Rewanż" option in the confirm after clicking "Nowa gra")
  
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
  
  // Show modal
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
  // CSS centering - allways in the center of the viewport, even on scroll, and works well with variable height content
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


// Show stats panel and highscores
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
      // Find the highest score in this game
      const maxScore = Math.max(...g.results.map(r => r.wynik));
      // Get all players with the highest score (tie)
      const winners = g.results.filter(r => r.wynik === maxScore);
      // Add +1 only if exactly one winner (no tie)
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
  
  // HISTORY OF RECENT GAMES
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
  
  // BUTTONS
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
  
  // Show modal - don't add event listener on backdrop to prevent closing
  setTimeout(() => modal.classList.add('aktywny'), 0);
}

/* =======================
   HELPER FUNCTIONS
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

document.addEventListener('mousedown', (e) => {
  // If the user clicked on something that is NOT the input container or its dropdown...
  if (!e.target.closest('.nazwa-input-container')) {
    // ...find all open dropdowns and close them immediately
    document.querySelectorAll('.nazwa-input-dropdown.aktywny').forEach(dropdown => {
      dropdown.classList.remove('aktywny');
    });
  }
});