# 🎲 Kości – Dice Game Scoreboard

**Kości** is a lightweight browser-based scoreboard designed for real-world dice games.

This project does **not** simulate dice rolls.  
Instead, it provides a clean and convenient interface for **tracking scores, players, and game history** while you roll physical dice at the table.

🔗 **Open the app:** https://eziseagal.github.io/kosci/  
📦 **Repository:** https://github.com/eziseagal/kosci

---

## 🕹️ Concept

Kości is meant to complement traditional tabletop play:

- 🎲 **Dice stay in your hands**
- 🧮 **Scores stay on the screen**

The application acts as a digital score table where players manually enter results from their physical dice rolls. It’s ideal for casual gatherings, board game nights, or any dice-based competition.

---

## 🌐 Global Player Statistics

Kości uses **Supabase** as a backend for global data persistence.

Unlike typical scoreboards that rely only on `localStorage`, Kości allows players to access the same statistics across multiple devices.

This means:

- Your scores are not tied to one browser  
- Player records are shared globally  
- Statistics remain available between sessions  

Open the app on another computer or laptop and your data is still there.

---

## 🔐 Nickname Verification via PIN

To prevent accidental overwrites or nickname collisions, Kości includes a simple identity mechanism:

- Each nickname can be protected by a PIN  
- The PIN acts as lightweight verification  
- Only verified users can modify their records  

This provides basic consistency without requiring accounts, emails, or authentication systems.

---

## 🚀 How to Use

1. Open the application in any modern web browser  
2. Enter or select player nicknames  
3. Verify your nickname using your PIN (if applicable)  
4. Roll your real dice  
5. Enter scores into the table  
6. Statistics update automatically  

No installation or registration required.

---

## 📌 Features

- 👥 Supports up to **10 players** per game  
- 🌐 Global statistics stored via Supabase  
- 🔐 Optional PIN-based nickname verification  
- 🧮 Fast manual score entry  
- 🕘 Persistent game & player history  
- 📱 Desktop and mobile friendly  
- ⚡ Minimal, distraction-free UI  

---

## 🎯 Design Philosophy

Kości is deliberately designed without digital dice mechanics.

Why?

Many tabletop players prefer:

- The tactile experience of physical dice  
- Real-world randomness  
- Social interaction at the table  

Kości simply replaces paper score sheets with a cleaner digital alternative.

---

## 🧰 Technologies

Kości is built using:

- HTML  
- CSS  
- JavaScript  
- Supabase (database & API)  

The frontend runs entirely in the browser.  
Supabase is used only for data persistence and synchronization.

---

## 🤝 Contributions

Contributions, ideas, and improvements are welcome.

Possible areas for enhancement:

- UI / UX refinements  
- Rule presets or templates  
- Additional statistics or analytics  
- Performance optimizations  

Feel free to open issues or submit pull requests.

---

## 📄 License

No explicit license file is currently provided.  
Refer to the repository for usage and distribution details.

---

Enjoy your game night and keep rolling 🎲
