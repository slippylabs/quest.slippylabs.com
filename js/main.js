// ============================================================================
// AetherQuest - Main Game Controller & UI Rendering
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initUI();
  await bootstrapGame();
});

let currentScreen = 'town';
let currentTownTab = 'square';
let activeCombatSubmenu = 'main'; // 'main', 'spells', 'items', 'swap'

async function bootstrapGame() {
  const isAuthed = await window.authManager.checkAuth();
  const savedData = await window.authManager.loadGame();

  if (savedData && savedData.classId) {
    window.gameEngine.loadPlayerState(savedData);
    showScreen('town');
  } else {
    // Show character creation / auth
    if (!isAuthed) {
      openModal('auth-modal');
    } else {
      openModal('char-create-modal');
    }
  }

  updateHeaderUI();
  renderTownView();
}

function initUI() {
  // Sound and Music buttons
  const soundBtn = document.getElementById('sound-btn');
  if (soundBtn) {
    soundBtn.textContent = window.soundEngine.enabled ? '🔊 Sound: ON' : '🔈 Sound: OFF';
    soundBtn.addEventListener('click', () => {
      const state = window.soundEngine.toggleSound();
      soundBtn.textContent = state ? '🔊 Sound: ON' : '🔈 Sound: OFF';
      window.soundEngine.click();
    });
  }

  const musicBtn = document.getElementById('music-btn');
  if (musicBtn) {
    musicBtn.textContent = window.soundEngine.musicEnabled ? '🎵 Music: ON' : '🔇 Music: OFF';
    musicBtn.addEventListener('click', () => {
      const state = window.soundEngine.toggleMusic();
      musicBtn.textContent = state ? '🎵 Music: ON' : '🔇 Music: OFF';
      window.soundEngine.click();
    });
  }

  // Rules Modal
  const rulesBtn = document.getElementById('rules-btn');
  if (rulesBtn) {
    rulesBtn.addEventListener('click', () => {
      window.soundEngine.click();
      openModal('rules-modal');
    });
  }

  // Auth Button in HUD
  const authBtn = document.getElementById('auth-btn');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      window.soundEngine.click();
      openModal('auth-modal');
    });
  }

  // Close modal buttons
  document.querySelectorAll('.modal-close, .close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.soundEngine.click();
      closeAllModals();
    });
  });

  // Setup Auth forms
  setupAuthForms();

  // Setup Character Creation
  setupCharCreateForm();

  // Hook Battle End events
  window.onBattleEnd = handleBattleEnd;
  window.updateCombatUI = renderCombatUI;
  window.renderCombatLogs = renderCombatLogs;
  window.displayDamageFloater = displayDamageFloater;
}

function setupAuthForms() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const guestBtn = document.getElementById('guest-play-btn');
  const authTabLogin = document.getElementById('tab-login');
  const authTabRegister = document.getElementById('tab-register');

  if (authTabLogin && authTabRegister) {
    authTabLogin.addEventListener('click', () => {
      authTabLogin.classList.add('active');
      authTabRegister.classList.remove('active');
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
    });

    authTabRegister.addEventListener('click', () => {
      authTabRegister.classList.add('active');
      authTabLogin.classList.remove('active');
      registerForm.style.display = 'block';
      loginForm.style.display = 'none';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      const errEl = document.getElementById('auth-error');
      errEl.textContent = 'Logging in...';

      const res = await window.authManager.login(u, p);
      if (res.ok) {
        closeAllModals();
        showToast(`⚔️ Welcome back, ${res.user.username}!`);
        await bootstrapGame();
      } else {
        errEl.textContent = res.error || 'Login failed';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('reg-username').value;
      const p = document.getElementById('reg-password').value;
      const errEl = document.getElementById('auth-error');
      errEl.textContent = 'Creating account...';

      const res = await window.authManager.register(u, p);
      if (res.ok) {
        closeAllModals();
        showToast(`🎉 Account created! Welcome, ${res.user.username}!`);
        openModal('char-create-modal');
      } else {
        errEl.textContent = res.error || 'Registration failed';
      }
    });
  }

  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      window.authManager.isGuest = true;
      closeAllModals();
      if (!window.gameEngine.player) {
        openModal('char-create-modal');
      } else {
        showScreen('town');
      }
    });
  }
}

function setupCharCreateForm() {
  const form = document.getElementById('char-create-form');
  const classCards = document.querySelectorAll('.class-select-card');
  let selectedClass = 'warrior';

  classCards.forEach(card => {
    card.addEventListener('click', () => {
      classCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedClass = card.dataset.class;
      window.soundEngine.click();
    });
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('hero-name-input').value.trim() || 'Hero';
      window.gameEngine.createNewPlayer(name, selectedClass);
      window.authManager.saveGame(window.gameEngine.player);
      closeAllModals();
      showToast(`🛡️ A new legend begins! Welcome, ${name} the ${CLASSES[selectedClass].name}!`);
      updateHeaderUI();
      renderTownView();
      showScreen('town');
    });
  }
}

// Screen Switcher
function showScreen(screen) {
  currentScreen = screen;
  const townEl = document.getElementById('town-screen');
  const battleEl = document.getElementById('battle-screen');

  if (screen === 'town') {
    if (townEl) townEl.style.display = 'block';
    if (battleEl) battleEl.style.display = 'none';
    renderTownView();
  } else if (screen === 'battle') {
    if (townEl) townEl.style.display = 'none';
    if (battleEl) battleEl.style.display = 'block';
    activeCombatSubmenu = 'main';
    renderCombatUI();
  }
  updateHeaderUI();
}

// Update Top HUD Header
function updateHeaderUI() {
  const p = window.gameEngine.player;
  if (!p) return;

  const nameEl = document.getElementById('hud-player-name');
  const classEl = document.getElementById('hud-player-class');
  const levelEl = document.getElementById('hud-player-level');
  const goldEl = document.getElementById('hud-player-gold');
  const hpText = document.getElementById('hud-hp-text');
  const hpFill = document.getElementById('hud-hp-fill');
  const mpText = document.getElementById('hud-mp-text');
  const mpFill = document.getElementById('hud-mp-fill');
  const xpText = document.getElementById('hud-xp-text');
  const xpFill = document.getElementById('hud-xp-fill');
  const authUserEl = document.getElementById('hud-auth-user');
  const statBadge = document.getElementById('hud-stat-badge');

  if (nameEl) nameEl.textContent = p.name;
  if (classEl) classEl.textContent = `${CLASSES[p.classId].icon} ${CLASSES[p.classId].name}`;
  if (levelEl) levelEl.textContent = `Lv. ${p.level}`;
  if (goldEl) goldEl.textContent = `💰 ${p.gold}`;

  const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
  const mpPct = Math.max(0, Math.min(100, Math.round((p.mp / p.maxMp) * 100)));
  const reqXp = window.gameEngine.getXpNeeded(p.level);
  const xpPct = Math.max(0, Math.min(100, Math.round((p.xp / reqXp) * 100)));

  if (hpText) hpText.textContent = `${p.hp} / ${p.maxHp}`;
  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (mpText) mpText.textContent = `${p.mp} / ${p.maxMp}`;
  if (mpFill) mpFill.style.width = `${mpPct}%`;
  if (xpText) xpText.textContent = `${p.xp} / ${reqXp} XP`;
  if (xpFill) xpFill.style.width = `${xpPct}%`;

  if (statBadge) {
    if (p.unallocatedPoints > 0) {
      statBadge.style.display = 'inline-flex';
      statBadge.textContent = `+${p.unallocatedPoints} Stat Pts!`;
    } else {
      statBadge.style.display = 'none';
    }
  }

  if (authUserEl) {
    if (window.authManager.user) {
      authUserEl.innerHTML = `<span class="auth-tag authed">👤 ${window.authManager.user.username}</span>`;
    } else {
      authUserEl.innerHTML = `<span class="auth-tag guest">👤 Guest [Login]</span>`;
    }
  }
}

// Render Town Views
function switchTownTab(tab) {
  currentTownTab = tab;
  window.soundEngine.click();
  renderTownView();
}

function renderTownView() {
  updateHeaderUI();
  const p = window.gameEngine.player;
  if (!p) return;

  const content = document.getElementById('town-content');
  if (!content) return;

  // Active tab button highlight
  document.querySelectorAll('.town-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTownTab);
  });

  let html = '';

  if (currentTownTab === 'square') {
    html = `
      <div class="town-banner">
        <h2>🏰 Battleon Haven</h2>
        <p class="town-desc">The central sanctuary of Lore. Rest from battles, acquire enchanted arms, and embark on grand adventures.</p>
      </div>

      <div class="town-grid">
        <div class="town-card" onclick="switchTownTab('inn')">
          <div class="card-icon">🛏️</div>
          <h3>Adventurer's Inn</h3>
          <p>Rest your weary bones to fully replenish HP & MP. Chat with patrons for battle rumors.</p>
          <button class="action-btn">Enter Inn</button>
        </div>

        <div class="town-card" onclick="switchTownTab('armory')">
          <div class="card-icon">⚔️</div>
          <h3>Blacksmith & Armory</h3>
          <p>Forge and purchase blades, maces, bows, and elemental armor sets.</p>
          <button class="action-btn">Enter Armory</button>
        </div>

        <div class="town-card" onclick="switchTownTab('spells')">
          <div class="card-icon">🔮</div>
          <h3>Spell Library</h3>
          <p>Study under master archmages and unlock devastating elemental spells.</p>
          <button class="action-btn">Study Spells</button>
        </div>

        <div class="town-card" onclick="switchTownTab('alchemist')">
          <div class="card-icon">🧪</div>
          <h3>Alchemist's Shop</h3>
          <p>Stock up on healing potions, mana draughts, cleansing salves, and bombs.</p>
          <button class="action-btn">Visit Shop</button>
        </div>

        <div class="town-card featured" onclick="switchTownTab('quests')">
          <div class="card-icon">🗺️</div>
          <h3>Quest Portal Gate</h3>
          <p>Step through the realm portal to explore wildernesses, dungeons, and the Endless Arena.</p>
          <button class="action-btn primary">Embark on Quest ⚔️</button>
        </div>

        <div class="town-card" onclick="switchTownTab('character')">
          <div class="card-icon">📜</div>
          <h3>Character Sheet</h3>
          <p>View your combat stats, allocate level-up points, and manage inventory.</p>
          <button class="action-btn">View Stats</button>
        </div>
      </div>
    `;
  } else if (currentTownTab === 'inn') {
    html = `
      <div class="shop-header">
        <button class="back-btn" onclick="switchTownTab('square')">← Back to Town</button>
        <h2>🛏️ The Haven Inn & Hearth</h2>
      </div>
      <div class="inn-view">
        <div class="inn-rest-box">
          <p>The warm fire crackles. A quick slumber here will completely restore all Health and Mana points.</p>
          <div class="inn-stats">
            <div>Current Health: <span class="green">${p.hp} / ${p.maxHp}</span></div>
            <div>Current Mana: <span class="blue">${p.mp} / ${p.maxMp}</span></div>
          </div>
          <button class="primary-btn pulse" onclick="window.townManager.restAtInn()">💤 Rest & Recover (Free)</button>
        </div>

        <div class="inn-lore-box">
          <h3>📜 Lore Master & Rumors</h3>
          <ul class="lore-list">
            <li>🔥 <strong>Elemental Wisdom:</strong> Fire incinerates Plant, Ice, and Undead foes, but is weak against Water.</li>
            <li>💧 <strong>Glacial Power:</strong> Water & Ice douse flame creatures and freezes swift attackers.</li>
            <li>✨ <strong>Radiant Light:</strong> Holy light strikes Undead, Vampires, and Necromancers with lethal 175% bonus damage!</li>
            <li>⚡ <strong>Tempest Shock:</strong> Earth grounds Lightning, while Lightning shocks Water creatures.</li>
            <li>🔄 <strong>Mid-Battle Gear Swapping:</strong> You can switch weapons in combat to target enemy weaknesses!</li>
          </ul>
        </div>
      </div>
    `;
  } else if (currentTownTab === 'armory') {
    html = `
      <div class="shop-header">
        <button class="back-btn" onclick="switchTownTab('square')">← Back to Town</button>
        <h2>⚔️ Blacksmith & Armory</h2>
        <div class="gold-badge">💰 Your Gold: ${p.gold}</div>
      </div>

      <div class="shop-tabs">
        <button class="tab-btn active" id="tab-arm-weapons">Weapons</button>
        <button class="tab-btn" id="tab-arm-armors">Armors & Robes</button>
      </div>

      <div class="shop-item-grid" id="armory-grid">
        ${renderArmoryWeapons(p)}
      </div>
    `;
  } else if (currentTownTab === 'spells') {
    html = `
      <div class="shop-header">
        <button class="back-btn" onclick="switchTownTab('square')">← Back to Town</button>
        <h2>🔮 Arcane Spell Library</h2>
        <div class="gold-badge">💰 Your Gold: ${p.gold}</div>
      </div>
      <div class="shop-item-grid">
        ${renderSpellShop(p)}
      </div>
    `;
  } else if (currentTownTab === 'alchemist') {
    html = `
      <div class="shop-header">
        <button class="back-btn" onclick="switchTownTab('square')">← Back to Town</button>
        <h2>🧪 Alchemist's Emporium</h2>
        <div class="gold-badge">💰 Your Gold: ${p.gold}</div>
      </div>
      <div class="shop-item-grid">
        ${renderAlchemistShop(p)}
      </div>
    `;
  } else if (currentTownTab === 'quests') {
    html = `
      <div class="shop-header">
        <button class="back-btn" onclick="switchTownTab('square')">← Back to Town</button>
        <h2>🗺️ Quest Portal & Destinations</h2>
      </div>
      <div class="quest-zone-grid">
        ${renderQuestZones(p)}
      </div>
    `;
  } else if (currentTownTab === 'character') {
    html = renderCharacterSheet(p);
  }

  content.innerHTML = html;

  // Armory sub-tab listeners
  const wTab = document.getElementById('tab-arm-weapons');
  const aTab = document.getElementById('tab-arm-armors');
  const armGrid = document.getElementById('armory-grid');
  if (wTab && aTab && armGrid) {
    wTab.addEventListener('click', () => {
      wTab.classList.add('active');
      aTab.classList.remove('active');
      armGrid.innerHTML = renderArmoryWeapons(p);
    });
    aTab.addEventListener('click', () => {
      aTab.classList.add('active');
      wTab.classList.remove('active');
      armGrid.innerHTML = renderArmoryArmors(p);
    });
  }
}

function renderArmoryWeapons(p) {
  return Object.values(WEAPONS).map(w => {
    const isEquipped = p.equipped.weapon === w.id;
    const isOwned = p.inventory.includes(w.id) || isEquipped;
    const canAfford = p.gold >= w.price;
    const meetsLevel = p.level >= w.reqLevel;
    const elem = ELEMENTS[w.element.toUpperCase()];

    return `
      <div class="item-card ${isEquipped ? 'equipped' : ''}">
        <div class="item-head">
          <span class="item-icon">${w.icon}</span>
          <div>
            <div class="item-name">${w.name} ${isEquipped ? '<span class="tag-eq">EQUIPPED</span>' : ''}</div>
            <div class="item-elem" style="color: ${elem.color}">${elem.icon} ${elem.name} • Lv.${w.reqLevel}</div>
          </div>
        </div>
        <p class="item-desc">${w.description}</p>
        <div class="item-stats">
          <span>ATK: +${w.attack}</span>
          ${w.magicBonus ? `<span>MAGIC: +${w.magicBonus}</span>` : ''}
          ${w.critBonus ? `<span>CRIT: +${w.critBonus}%</span>` : ''}
        </div>
        <div class="item-actions">
          ${isEquipped ? '<span class="status-text">In Hand</span>' : (
            isOwned ? `<button class="action-btn" onclick="window.townManager.equipItem('${w.id}')">Equip</button>` :
            `<button class="action-btn ${canAfford && meetsLevel ? 'primary' : 'disabled'}" onclick="window.townManager.buyItem('${w.id}')">Buy (${w.price} G)</button>`
          )}
        </div>
      </div>
    `;
  }).join('');
}

function renderArmoryArmors(p) {
  return Object.values(ARMORS).map(a => {
    const isEquipped = p.equipped.armor === a.id;
    const isOwned = p.inventory.includes(a.id) || isEquipped;
    const canAfford = p.gold >= a.price;
    const meetsLevel = p.level >= a.reqLevel;

    return `
      <div class="item-card ${isEquipped ? 'equipped' : ''}">
        <div class="item-head">
          <span class="item-icon">${a.icon}</span>
          <div>
            <div class="item-name">${a.name} ${isEquipped ? '<span class="tag-eq">EQUIPPED</span>' : ''}</div>
            <div class="item-elem">Armor • Lv.${a.reqLevel}</div>
          </div>
        </div>
        <p class="item-desc">${a.description}</p>
        <div class="item-stats">
          <span>DEF: +${a.defense}</span>
          ${a.dodgeBonus ? `<span>DODGE: +${a.dodgeBonus}%</span>` : ''}
        </div>
        <div class="item-actions">
          ${isEquipped ? '<span class="status-text">Worn</span>' : (
            isOwned ? `<button class="action-btn" onclick="window.townManager.equipItem('${a.id}')">Equip</button>` :
            `<button class="action-btn ${canAfford && meetsLevel ? 'primary' : 'disabled'}" onclick="window.townManager.buyItem('${a.id}')">Buy (${a.price} G)</button>`
          )}
        </div>
      </div>
    `;
  }).join('');
}

function renderSpellShop(p) {
  return Object.values(SPELLS).map(s => {
    const isKnown = p.spells.includes(s.id);
    const price = s.basePower ? Math.round(s.basePower * 12) : 180;
    const canAfford = p.gold >= price;
    const elem = ELEMENTS[s.element.toUpperCase()] || ELEMENTS.ARCANE;

    return `
      <div class="item-card ${isKnown ? 'known' : ''}">
        <div class="item-head">
          <span class="item-icon">${s.icon}</span>
          <div>
            <div class="item-name">${s.name} ${isKnown ? '<span class="tag-known">MASTERED</span>' : ''}</div>
            <div class="item-elem" style="color: ${elem.color}">${elem.icon} ${elem.name} • Cost: ${s.mpCost} MP</div>
          </div>
        </div>
        <p class="item-desc">${s.description}</p>
        <div class="item-actions">
          ${isKnown ? '<span class="status-text">In Spellbook</span>' :
            `<button class="action-btn ${canAfford ? 'primary' : 'disabled'}" onclick="window.townManager.buyItem('${s.id}')">Learn Tome (${price} G)</button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function renderAlchemistShop(p) {
  return Object.values(CONSUMABLES).map(c => {
    const canAfford = p.gold >= c.price;
    const ownedCount = p.inventory.filter(id => id === c.id).length;

    return `
      <div class="item-card">
        <div class="item-head">
          <span class="item-icon">${c.icon}</span>
          <div>
            <div class="item-name">${c.name}</div>
            <div class="item-elem">Consumable • Owned: ${ownedCount}</div>
          </div>
        </div>
        <p class="item-desc">${c.description}</p>
        <div class="item-actions">
          <button class="action-btn ${canAfford ? 'primary' : 'disabled'}" onclick="window.townManager.buyItem('${c.id}')">Buy (${c.price} G)</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderQuestZones(p) {
  return ZONES.map(z => {
    const isUnlocked = p.zonesUnlocked.includes(z.id) || p.level >= z.minLevel;
    const isBossCleared = z.boss && p.bossesDefeated.includes(z.boss);

    return `
      <div class="quest-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="quest-head">
          <span class="zone-icon">${z.icon}</span>
          <div>
            <h3>${z.name}</h3>
            <div class="zone-level">Recommended: ${z.recommendedLevel}</div>
          </div>
        </div>
        <p class="zone-desc">${z.description}</p>
        ${z.bossName ? `<div class="boss-tag">👑 Boss: ${z.bossName} ${isBossCleared ? '✅ (Defeated)' : ''}</div>` : ''}
        ${z.isGauntlet ? `<div class="boss-tag">🏆 Record: Wave ${p.gauntletHighScore || 0}</div>` : ''}
        <div class="quest-action">
          ${isUnlocked ?
            `<button class="primary-btn pulse" onclick="startZoneBattle('${z.id}', ${z.isGauntlet || false})">Enter Battle ⚔️</button>` :
            `<button class="action-btn disabled">🔒 Locked (Req Lv.${z.minLevel})</button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function renderCharacterSheet(p) {
  const curWeapon = WEAPONS[p.equipped.weapon] || WEAPONS.iron_sword;
  const curArmor = ARMORS[p.equipped.armor] || ARMORS.bronze_plate;
  const wElem = ELEMENTS[curWeapon.element.toUpperCase()];

  const critChance = Math.round((0.06 + (p.stats.dex * 0.004) + (p.stats.luk * 0.003) + ((curWeapon.critBonus || 0) * 0.01)) * 100);
  const dodgeChance = Math.round((0.05 + (p.stats.dex * 0.005) + ((curArmor.dodgeBonus || 0) * 0.01) + (p.classId === 'rogue' ? 0.12 : 0)) * 100);
  const totalAtk = curWeapon.attack + Math.round(p.stats.str * 1.6);
  const totalDef = curArmor.defense + Math.round(p.stats.end * 0.6);

  return `
    <div class="shop-header">
      <button class="back-btn" onclick="switchTownTab('square')">← Back to Town</button>
      <h2>📜 Character Stats & Loadout</h2>
      <div class="gold-badge">💰 Gold: ${p.gold}</div>
    </div>

    <div class="char-sheet-layout">
      <div class="char-stats-col">
        <h3>Attributes ${p.unallocatedPoints > 0 ? `<span class="pts-pill">+${p.unallocatedPoints} Unspent</span>` : ''}</h3>
        <div class="stat-row">
          <span>💪 Strength (STR): <strong>${p.stats.str}</strong></span>
          ${p.unallocatedPoints > 0 ? `<button class="add-stat-btn" onclick="allocateStat('str')">+</button>` : ''}
        </div>
        <div class="stat-row">
          <span>🎯 Dexterity (DEX): <strong>${p.stats.dex}</strong></span>
          ${p.unallocatedPoints > 0 ? `<button class="add-stat-btn" onclick="allocateStat('dex')">+</button>` : ''}
        </div>
        <div class="stat-row">
          <span>🔮 Intellect (INT): <strong>${p.stats.int}</strong></span>
          ${p.unallocatedPoints > 0 ? `<button class="add-stat-btn" onclick="allocateStat('int')">+</button>` : ''}
        </div>
        <div class="stat-row">
          <span>🛡️ Endurance (END): <strong>${p.stats.end}</strong></span>
          ${p.unallocatedPoints > 0 ? `<button class="add-stat-btn" onclick="allocateStat('end')">+</button>` : ''}
        </div>
        <div class="stat-row">
          <span>🍀 Luck (LUK): <strong>${p.stats.luk}</strong></span>
          ${p.unallocatedPoints > 0 ? `<button class="add-stat-btn" onclick="allocateStat('luk')">+</button>` : ''}
        </div>

        <h3 style="margin-top:20px;">Combat Rating</h3>
        <div class="rating-grid">
          <div>Physical ATK: <strong>${totalAtk}</strong></div>
          <div>Physical DEF: <strong>${totalDef}</strong></div>
          <div>Critical Chance: <strong>${critChance}%</strong></div>
          <div>Evasion Rate: <strong>${dodgeChance}%</strong></div>
        </div>

        <div class="cloud-save-box">
          <button class="primary-btn" onclick="window.authManager.saveGame(window.gameEngine.player)">💾 Manual Cloud Save</button>
          <div id="save-status" class="save-status-label">${window.authManager.isGuest ? 'Guest Mode (Saved Locally)' : 'Cloud Synced ✓'}</div>
        </div>
      </div>

      <div class="char-inv-col">
        <h3>Equipped Gear</h3>
        <div class="equipped-box">
          <div class="eq-slot">
            <span class="slot-label">Weapon:</span>
            <strong>${curWeapon.icon} ${curWeapon.name}</strong>
            <span style="color:${wElem.color}">(${wElem.name})</span>
          </div>
          <div class="eq-slot">
            <span class="slot-label">Armor:</span>
            <strong>${curArmor.icon} ${curArmor.name}</strong>
          </div>
        </div>

        <h3 style="margin-top:20px;">Backpack Inventory (${p.inventory.length} items)</h3>
        <div class="inventory-list">
          ${p.inventory.length === 0 ? '<p class="dim">Backpack is empty.</p>' :
            p.inventory.map((itemId, idx) => {
              const item = WEAPONS[itemId] || ARMORS[itemId] || CONSUMABLES[itemId];
              if (!item) return '';
              const isEquipable = item.type === 'weapon' || item.type === 'armor';
              return `
                <div class="inv-item-row">
                  <span>${item.icon} ${item.name}</span>
                  <div class="inv-btns">
                    ${isEquipable ? `<button class="btn-sm" onclick="window.townManager.equipItem('${itemId}')">Equip</button>` : ''}
                    <button class="btn-sm danger" onclick="window.townManager.sellItem('${itemId}', ${idx})">Sell</button>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
      </div>
    </div>
  `;
}

function allocateStat(stat) {
  window.gameEngine.allocateStatPoint(stat);
  renderTownView();
}

function startZoneBattle(zoneId, isGauntlet) {
  window.soundEngine.click();
  window.gameEngine.startBattle(zoneId, isGauntlet, 1);
  showScreen('battle');
}

// Render Combat UI
function renderCombatUI() {
  updateHeaderUI();
  const enemy = window.gameEngine.currentEnemy;
  const p = window.gameEngine.player;
  if (!enemy || !p) return;

  const enemyName = document.getElementById('battle-enemy-name');
  const enemyLevel = document.getElementById('battle-enemy-level');
  const enemySprite = document.getElementById('battle-enemy-sprite');
  const enemyHpText = document.getElementById('battle-enemy-hp-text');
  const enemyHpFill = document.getElementById('battle-enemy-hp-fill');
  const enemyElem = document.getElementById('battle-enemy-elem');
  const enemyDebuffs = document.getElementById('battle-enemy-debuffs');

  const playerSprite = document.getElementById('battle-player-sprite');
  const playerBuffs = document.getElementById('battle-player-buffs');

  if (enemyName) enemyName.textContent = enemy.name;
  if (enemyLevel) enemyLevel.textContent = `Lv. ${enemy.level} ${enemy.isBoss ? '👑 BOSS' : ''}`;
  if (enemySprite) enemySprite.textContent = enemy.icon;
  if (playerSprite) playerSprite.textContent = CLASSES[p.classId].icon;

  const enemyHpPct = Math.max(0, Math.min(100, Math.round((enemy.currentHp / enemy.maxHp) * 100)));
  if (enemyHpText) enemyHpText.textContent = `${enemy.currentHp} / ${enemy.maxHp}`;
  if (enemyHpFill) enemyHpFill.style.width = `${enemyHpPct}%`;

  const elemData = ELEMENTS[enemy.element.toUpperCase()] || ELEMENTS.PHYSICAL;
  if (enemyElem) {
    let weakHtml = enemy.weakness ? ` • Weak: <strong style="color:#ff9130">${enemy.weakness.toUpperCase()}</strong>` : '';
    enemyElem.innerHTML = `<span style="color:${elemData.color}">${elemData.icon} ${elemData.name}</span>${weakHtml}`;
  }

  // Render Buff / Debuff tags
  if (enemyDebuffs) {
    enemyDebuffs.innerHTML = window.gameEngine.battleBuffs.enemy.map(b => `<span class="buff-pill debuff">${b.type} (${b.turns})</span>`).join('');
  }
  if (playerBuffs) {
    playerBuffs.innerHTML = window.gameEngine.battleBuffs.player.map(b => `<span class="buff-pill">${b.name || b.type} (${b.turns})</span>`).join('');
  }

  renderCombatControls();
}

function renderCombatControls() {
  const menuContainer = document.getElementById('battle-action-controls');
  if (!menuContainer) return;

  const p = window.gameEngine.player;
  const isPlayerTurn = window.gameEngine.isPlayerTurn;

  if (!isPlayerTurn) {
    menuContainer.innerHTML = `
      <div class="turn-waiting">
        <span class="spinner"></span> Enemy is choosing an action...
      </div>
    `;
    return;
  }

  if (activeCombatSubmenu === 'main') {
    menuContainer.innerHTML = `
      <div class="battle-menu-grid">
        <button class="battle-btn attack-btn" onclick="executeBattleAction('attack')">
          <span class="btn-icon">⚔️</span>
          <span>Attack</span>
        </button>
        <button class="battle-btn spell-btn" onclick="openCombatSubmenu('spells')">
          <span class="btn-icon">🔮</span>
          <span>Spells (${p.spells.length})</span>
        </button>
        <button class="battle-btn item-btn" onclick="openCombatSubmenu('items')">
          <span class="btn-icon">🧪</span>
          <span>Items (${p.inventory.filter(id => CONSUMABLES[id]).length})</span>
        </button>
        <button class="battle-btn swap-btn" onclick="openCombatSubmenu('swap')">
          <span class="btn-icon">🔄</span>
          <span>Swap Gear</span>
        </button>
        <button class="battle-btn guard-btn" onclick="executeBattleAction('guard')">
          <span class="btn-icon">🛡️</span>
          <span>Guard</span>
        </button>
        <button class="battle-btn flee-btn" onclick="executeBattleAction('flee')">
          <span class="btn-icon">💨</span>
          <span>Flee</span>
        </button>
      </div>
    `;
  } else if (activeCombatSubmenu === 'spells') {
    const spellList = p.spells.map(sId => SPELLS[sId]).filter(Boolean);
    menuContainer.innerHTML = `
      <div class="submenu-wrap">
        <div class="submenu-header">
          <button class="back-btn-sm" onclick="openCombatSubmenu('main')">← Back</button>
          <span>Choose Spell / Skill</span>
        </div>
        <div class="submenu-grid">
          ${spellList.map(s => {
            const hasMp = p.mp >= s.mpCost;
            const elem = ELEMENTS[s.element.toUpperCase()] || ELEMENTS.ARCANE;
            return `
              <button class="sub-btn ${hasMp ? '' : 'disabled'}" onclick="executeBattleAction('spell', '${s.id}')">
                <div class="sub-title">${s.icon} ${s.name}</div>
                <div class="sub-meta" style="color:${elem.color}">${elem.icon} ${elem.name} • ${s.mpCost} MP</div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (activeCombatSubmenu === 'items') {
    const items = p.inventory.map(id => CONSUMABLES[id]).filter(Boolean);
    menuContainer.innerHTML = `
      <div class="submenu-wrap">
        <div class="submenu-header">
          <button class="back-btn-sm" onclick="openCombatSubmenu('main')">← Back</button>
          <span>Use Battle Item</span>
        </div>
        <div class="submenu-grid">
          ${items.length === 0 ? '<p class="dim" style="grid-column:span 2">No consumable potions or bombs in inventory.</p>' :
            items.map(item => `
              <button class="sub-btn" onclick="executeBattleAction('item', '${item.id}')">
                <div class="sub-title">${item.icon} ${item.name}</div>
                <div class="sub-meta">${item.description}</div>
              </button>
            `).join('')
          }
        </div>
      </div>
    `;
  } else if (activeCombatSubmenu === 'swap') {
    const weapons = p.inventory.map(id => WEAPONS[id]).filter(Boolean);
    const armors = p.inventory.map(id => ARMORS[id]).filter(Boolean);

    menuContainer.innerHTML = `
      <div class="submenu-wrap">
        <div class="submenu-header">
          <button class="back-btn-sm" onclick="openCombatSubmenu('main')">← Back</button>
          <span>Swap Active Weapon / Armor (Free Action!)</span>
        </div>
        <div class="submenu-grid">
          ${weapons.map(w => {
            const isEquipped = p.equipped.weapon === w.id;
            const elem = ELEMENTS[w.element.toUpperCase()];
            return `
              <button class="sub-btn ${isEquipped ? 'active' : ''}" onclick="executeBattleAction('swap_weapon', '${w.id}')">
                <div class="sub-title">${w.icon} ${w.name} ${isEquipped ? '(Equipped)' : ''}</div>
                <div class="sub-meta" style="color:${elem.color}">Element: ${elem.name} • ATK +${w.attack}</div>
              </button>
            `;
          }).join('')}
          ${armors.map(a => {
            const isEquipped = p.equipped.armor === a.id;
            return `
              <button class="sub-btn ${isEquipped ? 'active' : ''}" onclick="executeBattleAction('swap_armor', '${a.id}')">
                <div class="sub-title">${a.icon} ${a.name} ${isEquipped ? '(Equipped)' : ''}</div>
                <div class="sub-meta">Armor • DEF +${a.defense}</div>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

function openCombatSubmenu(menu) {
  window.soundEngine.click();
  activeCombatSubmenu = menu;
  renderCombatControls();
}

function executeBattleAction(type, param) {
  window.gameEngine.executePlayerAction(type, param);
}

// Combat Logs Rendering
function renderCombatLogs() {
  const logContainer = document.getElementById('combat-log-stream');
  if (!logContainer) return;

  logContainer.innerHTML = window.gameEngine.combatLogs.map(log => `
    <div class="log-entry log-${log.type}">
      <span class="log-time">${log.time}</span>
      <span class="log-text">${log.msg}</span>
    </div>
  `).join('');
}

// Floating Damage Numbers
function displayDamageFloater(target, text, isCrit, elem) {
  const stage = document.getElementById('battle-arena');
  if (!stage) return;

  const floater = document.createElement('div');
  floater.className = `damage-floater ${target} ${isCrit ? 'crit' : ''} elem-${elem}`;
  floater.textContent = text;

  stage.appendChild(floater);
  setTimeout(() => floater.remove(), 1000);
}

// Battle Resolution Modals
function handleBattleEnd(status, data) {
  if (status === 'flee') {
    showScreen('town');
    return;
  }

  if (status === 'victory') {
    const modal = document.getElementById('victory-modal');
    if (modal) {
      document.getElementById('vic-enemy-name').textContent = data.enemy.name;
      document.getElementById('vic-gold').textContent = `+${data.gold} G`;
      document.getElementById('vic-xp').textContent = `+${data.xp} EXP`;
      const lvlNotice = document.getElementById('vic-level-notice');
      if (lvlNotice) {
        lvlNotice.style.display = data.leveledUp ? 'block' : 'none';
      }
      openModal('victory-modal');
    }
  } else if (status === 'defeat') {
    const modal = document.getElementById('defeat-modal');
    if (modal) {
      document.getElementById('def-enemy-name').textContent = data.enemy.name;
      openModal('defeat-modal');
    }
  }
}

function returnToTownFromBattle() {
  closeAllModals();
  window.soundEngine.click();
  showScreen('town');
}

// Modal Helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

// Toast Notifications
function showToast(msg) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

window.showToast = showToast;
window.switchTownTab = switchTownTab;
window.renderTownView = renderTownView;
window.startZoneBattle = startZoneBattle;
window.openCombatSubmenu = openCombatSubmenu;
window.executeBattleAction = executeBattleAction;
window.allocateStat = allocateStat;
window.returnToTownFromBattle = returnToTownFromBattle;
