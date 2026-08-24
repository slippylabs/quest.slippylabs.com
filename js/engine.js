// ============================================================================
// AetherQuest - Turn-Based JRPG Combat & Game Engine
// ============================================================================

class GameEngine {
  constructor() {
    this.player = null;
    this.currentEnemy = null;
    this.currentZone = null;
    this.isGauntlet = false;
    this.gauntletWave = 1;
    this.inBattle = false;
    this.isPlayerTurn = true;
    this.combatLogs = [];
    this.battleBuffs = {
      player: [],
      enemy: []
    };
    this.isGuarding = false;
  }

  // Create or Initialize a default character
  createNewPlayer(name, classKey) {
    const classData = CLASSES[classKey] || CLASSES.warrior;
    const baseStats = { ...classData.baseStats };

    this.player = {
      name: name || 'Hero of Lore',
      classId: classKey,
      level: 1,
      xp: 0,
      gold: 150,
      stats: baseStats,
      unallocatedPoints: 0,
      equipped: {
        weapon: classData.starterWeapon,
        armor: classData.starterArmor
      },
      inventory: [
        'health_potion_s',
        'health_potion_s',
        'mana_potion_s',
        'antidote'
      ],
      spells: [...classData.skills],
      zonesUnlocked: ['wilds', 'gauntlet'],
      bossesDefeated: [],
      gauntletHighScore: 0
    };

    this.recalculatePlayerStats(true);
    return this.player;
  }

  loadPlayerState(saveData) {
    if (!saveData || !saveData.classId) {
      return this.createNewPlayer('Hero', 'warrior');
    }
    this.player = {
      name: saveData.name || 'Hero',
      classId: saveData.classId || 'warrior',
      level: saveData.level || 1,
      xp: saveData.xp || 0,
      gold: saveData.gold || 0,
      stats: saveData.stats || { ...CLASSES[saveData.classId || 'warrior'].baseStats },
      unallocatedPoints: saveData.unallocatedPoints || 0,
      equipped: saveData.equipped || {
        weapon: CLASSES[saveData.classId || 'warrior'].starterWeapon,
        armor: CLASSES[saveData.classId || 'warrior'].starterArmor
      },
      inventory: saveData.inventory || ['health_potion_s'],
      spells: saveData.spells || [...CLASSES[saveData.classId || 'warrior'].skills],
      zonesUnlocked: saveData.zonesUnlocked || ['wilds', 'gauntlet'],
      bossesDefeated: saveData.bossesDefeated || [],
      gauntletHighScore: saveData.gauntletHighScore || 0
    };

    this.recalculatePlayerStats(true);
    return this.player;
  }

  getXpNeeded(level) {
    return Math.floor(90 * Math.pow(1.22, level - 1));
  }

  recalculatePlayerStats(restoreCurrent = false) {
    if (!this.player) return;
    const p = this.player;
    const classData = CLASSES[p.classId] || CLASSES.warrior;

    p.maxHp = 50 + (p.stats.end * 14) + (p.level * classData.statGrowths.hp);
    p.maxMp = 30 + (p.stats.int * 10) + (p.level * classData.statGrowths.mp);

    // Class passives
    if (p.classId === 'warrior') {
      p.maxHp = Math.round(p.maxHp * 1.12);
    } else if (p.classId === 'mage') {
      p.maxMp += 25;
    }

    if (restoreCurrent || p.hp === undefined || p.hp > p.maxHp) {
      p.hp = p.maxHp;
    }
    if (restoreCurrent || p.mp === undefined || p.mp > p.maxMp) {
      p.mp = p.maxMp;
    }
  }

  // Start Combat Encounter
  startBattle(zoneId, isGauntlet = false, wave = 1) {
    this.currentZone = ZONES.find(z => z.id === zoneId) || ZONES[0];
    this.isGauntlet = isGauntlet;
    this.gauntletWave = wave;
    this.inBattle = true;
    this.isPlayerTurn = true;
    this.isGuarding = false;
    this.combatLogs = [];
    this.battleBuffs = { player: [], enemy: [] };

    let enemyKey;
    if (isGauntlet) {
      // Pick random monster scaled to wave
      const allMonsters = Object.keys(MONSTER_TEMPLATES);
      enemyKey = allMonsters[Math.floor(Math.random() * allMonsters.length)];
    } else {
      // Zone normal encounter or boss if unlocked
      const pool = [...this.currentZone.enemies];
      if (Math.random() < 0.25 || this.player.zonesUnlocked.includes(this.currentZone.id + '_boss')) {
        pool.push(this.currentZone.boss);
      }
      enemyKey = pool[Math.floor(Math.random() * pool.length)];
    }

    this.currentEnemy = generateScaledMonster(
      enemyKey,
      this.player.level,
      isGauntlet,
      wave
    );

    this.log(`⚔️ Encounter! A wild **${this.currentEnemy.name}** (Lv.${this.currentEnemy.level}) appears!`, 'event');
    if (this.currentEnemy.weakness) {
      const weakElem = ELEMENTS[this.currentEnemy.weakness.toUpperCase()];
      this.log(`💡 Scout Report: Vulnerable to **${weakElem ? weakElem.name : this.currentEnemy.weakness}**!`, 'info');
    }

    window.soundEngine.playTone(300, 'triangle', 0.2, 0.15, 100);
    return this.currentEnemy;
  }

  // Player Turn Execution
  async executePlayerAction(type, arg) {
    if (!this.inBattle || !this.isPlayerTurn || !this.currentEnemy) return;

    this.isPlayerTurn = false;
    let turnEnded = true;

    if (type === 'attack') {
      await this.handlePlayerAttack();
    } else if (type === 'spell') {
      const spell = SPELLS[arg];
      if (!spell) return;
      if (this.player.mp < spell.mpCost) {
        this.log(`⚠️ Not enough Mana to cast ${spell.name}! (Requires ${spell.mpCost} MP)`, 'warn');
        this.isPlayerTurn = true;
        return;
      }
      this.player.mp -= spell.mpCost;
      await this.handlePlayerSpell(spell);
    } else if (type === 'item') {
      const item = CONSUMABLES[arg];
      if (!item) return;
      await this.handlePlayerItem(item, arg);
    } else if (type === 'swap_weapon') {
      this.player.equipped.weapon = arg;
      const w = WEAPONS[arg];
      this.log(`🔄 Equipped **${w.name}** (${ELEMENTS[w.element.toUpperCase()].name})!`, 'info');
      window.soundEngine.click();
      // Free action: player still gets to attack!
      this.isPlayerTurn = true;
      turnEnded = false;
    } else if (type === 'swap_armor') {
      this.player.equipped.armor = arg;
      const a = ARMORS[arg];
      this.log(`🔄 Donned **${a.name}**!`, 'info');
      window.soundEngine.click();
      this.isPlayerTurn = true;
      turnEnded = false;
    } else if (type === 'guard') {
      this.isGuarding = true;
      const mpRegen = Math.max(5, Math.floor(this.player.maxMp * 0.1));
      const hpRegen = Math.max(8, Math.floor(this.player.maxHp * 0.05));
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpRegen);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + hpRegen);
      this.log(`🛡️ You take a guarded stance! Recovered ${hpRegen} HP and ${mpRegen} MP.`, 'buff');
      window.soundEngine.heal();
    } else if (type === 'flee') {
      if (this.currentEnemy.isBoss) {
        this.log(`🚫 You cannot flee from a Boss battle!`, 'warn');
        this.isPlayerTurn = true;
        return;
      }
      const fleeChance = 0.5 + (this.player.stats.dex * 0.015) + (this.player.stats.luk * 0.01);
      if (Math.random() < fleeChance) {
        this.log(`💨 You successfully fled from battle!`, 'event');
        window.soundEngine.dodge();
        this.inBattle = false;
        if (window.onBattleEnd) window.onBattleEnd('flee');
        return;
      } else {
        this.log(`❌ Failed to escape! The monster blocks your path.`, 'warn');
      }
    }

    if (window.updateCombatUI) window.updateCombatUI();

    // Check if enemy defeated
    if (this.currentEnemy.currentHp <= 0) {
      await this.handleVictory();
      return;
    }

    if (turnEnded) {
      await this.delay(650);
      await this.handleEnemyTurn();
    }
  }

  async handlePlayerAttack() {
    const weapon = WEAPONS[this.player.equipped.weapon] || WEAPONS.iron_sword;
    const elem = weapon.element || 'physical';
    
    // Hit / Miss / Crit calculations
    const hitChance = 0.88 + (this.player.stats.dex * 0.005);
    if (Math.random() > hitChance) {
      this.log(`💨 Your attack missed the ${this.currentEnemy.name}!`, 'miss');
      window.soundEngine.dodge();
      return;
    }

    const critChance = 0.06 + (this.player.stats.dex * 0.004) + (this.player.stats.luk * 0.003) + ((weapon.critBonus || 0) * 0.01);
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? (1.6 + (this.player.stats.luk * 0.015)) : 1.0;

    // Base damage
    let baseDmg = weapon.attack + (this.player.stats.str * 1.6) + (this.player.stats.dex * 0.4);
    if (this.player.classId === 'warrior') baseDmg *= 1.15;

    // Elemental Advantage multiplier
    const elemMult = this.calculateElementalMultiplier(elem, this.currentEnemy.element, this.currentEnemy.weakness);

    // Monster Defense reduction
    const defReduction = Math.max(0.35, 1 - (this.currentEnemy.defense / (this.currentEnemy.defense + 100)));
    let totalDmg = Math.max(1, Math.round(baseDmg * elemMult * critMult * defReduction));

    this.currentEnemy.currentHp = Math.max(0, this.currentEnemy.currentHp - totalDmg);

    if (isCrit) {
      window.soundEngine.crit();
      this.triggerScreenShake();
      this.log(`💥 **CRITICAL STRIKE!** You struck ${this.currentEnemy.name} for **${totalDmg}** ${elem} damage!`, 'crit');
      this.showDamageFloater('enemy', totalDmg, true, elem);
    } else {
      window.soundEngine.attack();
      let elemNotice = elemMult > 1.2 ? ' (SUPER EFFECTIVE!)' : (elemMult < 0.8 ? ' (Resisted)' : '');
      this.log(`⚔️ You attacked ${this.currentEnemy.name} with ${weapon.name} for **${totalDmg}** damage!${elemNotice}`, 'player');
      this.showDamageFloater('enemy', totalDmg, false, elem);
    }
  }

  async handlePlayerSpell(spell) {
    window.soundEngine.spellCast(spell.element);

    if (spell.healPower) {
      // Healing spell
      const healAmt = Math.round(spell.healPower + (this.player.stats.int * 2.2));
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
      this.log(`💖 Cast **${spell.name}**! Restored **${healAmt}** Health.`, 'heal');
      window.soundEngine.heal();
      this.showDamageFloater('player', `+${healAmt}`, false, 'heal');
      return;
    }

    if (spell.buff) {
      this.battleBuffs.player.push({
        type: spell.buff.type,
        turns: spell.buff.turns,
        value: spell.buff.value,
        name: spell.name
      });
      this.log(`✨ Cast **${spell.name}**! Applied ${spell.buff.type} for ${spell.buff.turns} turns.`, 'buff');
      return;
    }

    // Offensive Spell
    let basePower = spell.basePower || 40;
    if (spell.damageMult) {
      const weapon = WEAPONS[this.player.equipped.weapon] || WEAPONS.iron_sword;
      basePower = (weapon.attack + (this.player.stats.str * 1.5)) * spell.damageMult;
    } else {
      basePower += (this.player.stats.int * 2.0);
    }

    if (this.player.classId === 'mage') basePower *= 1.25;
    if (this.player.classId === 'paladin' && spell.element === 'light') basePower *= 1.25;
    if (this.player.classId === 'necromancer' && spell.element === 'darkness') basePower *= 1.20;

    const elemMult = this.calculateElementalMultiplier(spell.element, this.currentEnemy.element, this.currentEnemy.weakness);
    let totalDmg = Math.max(1, Math.round(basePower * elemMult));

    this.currentEnemy.currentHp = Math.max(0, this.currentEnemy.currentHp - totalDmg);

    this.log(`🔮 Cast **${spell.name}** on ${this.currentEnemy.name} dealing **${totalDmg}** ${spell.element} damage!`, 'player');
    this.showDamageFloater('enemy', totalDmg, false, spell.element);

    // Life steal / drain
    if (spell.drainPercent || this.player.classId === 'necromancer') {
      const drainRatio = (spell.drainPercent || 0) + (this.player.classId === 'necromancer' ? 0.12 : 0);
      const leechAmt = Math.round(totalDmg * drainRatio);
      if (leechAmt > 0) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + leechAmt);
        this.log(`🩸 Siphoned **${leechAmt}** HP from the enemy!`, 'heal');
      }
    }

    // Status effect application
    if (spell.burn && Math.random() < 0.85) {
      this.battleBuffs.enemy.push({ type: 'burn', turns: spell.burn.turns, dmg: Math.round(spell.burn.dmg + this.player.stats.int * 0.4) });
      this.log(`🔥 ${this.currentEnemy.name} is engulfed in flames!`, 'debuff');
    }
    if (spell.poison && Math.random() < 0.85) {
      this.battleBuffs.enemy.push({ type: 'poison', turns: spell.poison.turns, dmg: Math.round(spell.poison.dmg + this.player.stats.dex * 0.5) });
      this.log(`🧪 ${this.currentEnemy.name} was afflicted by deadly venom!`, 'debuff');
    }
    if (spell.freezeChance && Math.random() < spell.freezeChance) {
      this.battleBuffs.enemy.push({ type: 'freeze', turns: 1 });
      this.log(`❄️ ${this.currentEnemy.name} was frozen solid in ice!`, 'debuff');
    }
    if (spell.stunChance && Math.random() < spell.stunChance) {
      this.battleBuffs.enemy.push({ type: 'stun', turns: 1 });
      this.log(`💫 ${this.currentEnemy.name} is stunned!`, 'debuff');
    }
  }

  async handlePlayerItem(item, itemKey) {
    const idx = this.player.inventory.indexOf(itemKey);
    if (idx !== -1) {
      this.player.inventory.splice(idx, 1);
    }

    if (item.effect === 'heal') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + item.value);
      this.log(`🧪 Consumed **${item.name}**! Restored **${item.value}** HP.`, 'heal');
      window.soundEngine.potion();
      this.showDamageFloater('player', `+${item.value}`, false, 'heal');
    } else if (item.effect === 'mana') {
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + item.value);
      this.log(`🧪 Consumed **${item.name}**! Restored **${item.value}** MP.`, 'heal');
      window.soundEngine.potion();
      this.showDamageFloater('player', `+${item.value} MP`, false, 'mana');
    } else if (item.effect === 'cleanse') {
      this.battleBuffs.player = this.battleBuffs.player.filter(b => b.type !== 'poison' && b.type !== 'burn' && b.type !== 'bleed');
      this.log(`✨ Drank **${item.name}**! All harmful status conditions cleansed.`, 'buff');
      window.soundEngine.heal();
    } else if (item.effect === 'damage') {
      this.currentEnemy.currentHp = Math.max(0, this.currentEnemy.currentHp - item.value);
      this.log(`💣 Threw **${item.name}** at ${this.currentEnemy.name} dealing **${item.value}** explosive damage!`, 'crit');
      window.soundEngine.crit();
      this.showDamageFloater('enemy', item.value, true, item.element || 'fire');
    }
  }

  // Enemy Turn Execution
  async handleEnemyTurn() {
    if (!this.inBattle || !this.currentEnemy || this.currentEnemy.currentHp <= 0) return;

    // Check Enemy Debuffs (Freeze / Stun)
    const isFrozen = this.battleBuffs.enemy.find(b => b.type === 'freeze' || b.type === 'stun');
    if (isFrozen) {
      this.log(`❄️ ${this.currentEnemy.name} is incapacitated and unable to act!`, 'event');
      this.battleBuffs.enemy = this.battleBuffs.enemy.filter(b => b.type !== 'freeze' && b.type !== 'stun');
      this.advanceTurnPhase();
      return;
    }

    // Process Enemy DoTs
    for (let debuff of this.battleBuffs.enemy) {
      if (debuff.dmg && (debuff.type === 'burn' || debuff.type === 'poison' || debuff.type === 'bleed')) {
        this.currentEnemy.currentHp = Math.max(0, this.currentEnemy.currentHp - debuff.dmg);
        this.log(`🔥 ${this.currentEnemy.name} took **${debuff.dmg}** ${debuff.type} tick damage!`, 'debuff');
        this.showDamageFloater('enemy', debuff.dmg, false, debuff.type);
      }
      debuff.turns--;
    }
    this.battleBuffs.enemy = this.battleBuffs.enemy.filter(b => b.turns > 0);

    if (this.currentEnemy.currentHp <= 0) {
      await this.handleVictory();
      return;
    }

    // Player Evasion check
    const armor = ARMORS[this.player.equipped.armor] || ARMORS.bronze_plate;
    const dodgeChance = 0.05 + (this.player.stats.dex * 0.005) + ((armor.dodgeBonus || 0) * 0.01) + (this.player.classId === 'rogue' ? 0.12 : 0);
    const shadowDodge = this.battleBuffs.player.find(b => b.type === 'dodge');
    const totalDodge = shadowDodge ? (dodgeChance + shadowDodge.value) : dodgeChance;

    if (Math.random() < totalDodge) {
      this.log(`💨 You agilely dodged ${this.currentEnemy.name}'s incoming attack!`, 'miss');
      window.soundEngine.dodge();
      this.showDamageFloater('player', 'DODGE', false, 'miss');
      this.advanceTurnPhase();
      return;
    }

    // Enemy Attack calculation
    let enemyAtk = this.currentEnemy.attack;
    const enemyElem = this.currentEnemy.element || 'physical';
    
    // Player Armor & Resistance
    const playerDef = (armor.defense || 0) + (this.player.stats.end * 0.6);
    const defMultiplier = Math.max(0.30, 1 - (playerDef / (playerDef + 120)));
    
    // Armor Elemental Resistance
    const elemResist = (armor.resistances && armor.resistances[enemyElem]) || 0;
    const resistMultiplier = Math.max(0.2, 1 - elemResist);

    let incomingDmg = Math.max(1, Math.round(enemyAtk * defMultiplier * resistMultiplier));

    // Guard modifier
    if (this.isGuarding) {
      incomingDmg = Math.max(1, Math.round(incomingDmg * 0.5));
    }

    // Shield/Barrier Buffs
    const barrier = this.battleBuffs.player.find(b => b.type === 'barrier');
    if (barrier) {
      if (barrier.value >= incomingDmg) {
        barrier.value -= incomingDmg;
        this.log(`🔮 Your Mana Shield absorbed all **${incomingDmg}** incoming damage! (${barrier.value} barrier left)`, 'buff');
        incomingDmg = 0;
      } else {
        incomingDmg -= barrier.value;
        this.log(`🔮 Mana Shield shattered absorbing **${barrier.value}** damage!`, 'buff');
        barrier.value = 0;
      }
      this.battleBuffs.player = this.battleBuffs.player.filter(b => b.value > 0);
    }

    if (incomingDmg > 0) {
      this.player.hp = Math.max(0, this.player.hp - incomingDmg);
      window.soundEngine.attack();
      this.triggerScreenShake();
      this.log(`💥 **${this.currentEnemy.name}** struck you for **${incomingDmg}** damage!`, 'enemy');
      this.showDamageFloater('player', incomingDmg, false, enemyElem);
    }

    // Check player defeat
    if (this.player.hp <= 0) {
      await this.handleDefeat();
      return;
    }

    this.advanceTurnPhase();
  }

  advanceTurnPhase() {
    this.isGuarding = false;
    this.isPlayerTurn = true;
    
    // Decrement player buffs
    for (let buff of this.battleBuffs.player) {
      buff.turns--;
    }
    this.battleBuffs.player = this.battleBuffs.player.filter(b => b.turns > 0);

    if (window.updateCombatUI) window.updateCombatUI();
  }

  // Victory Resolution
  async handleVictory() {
    this.inBattle = false;
    window.soundEngine.victory();

    const xpGained = this.currentEnemy.xpReward;
    const goldGained = this.currentEnemy.goldReward;
    this.player.xp += xpGained;
    this.player.gold += goldGained;

    this.log(`🎉 **VICTORY!** Defeated ${this.currentEnemy.name}!`, 'event');
    this.log(`💰 Earned **+${goldGained} Gold** and **+${xpGained} EXP**!`, 'info');

    // Boss defeat tracking
    if (this.currentEnemy.isBoss) {
      if (!this.player.bossesDefeated.includes(this.currentEnemy.id)) {
        this.player.bossesDefeated.push(this.currentEnemy.id);
      }
      // Unlock next zone
      const nextZoneIdx = ZONES.findIndex(z => z.id === this.currentZone.id) + 1;
      if (nextZoneIdx < ZONES.length && !this.player.zonesUnlocked.includes(ZONES[nextZoneIdx].id)) {
        this.player.zonesUnlocked.push(ZONES[nextZoneIdx].id);
        this.log(`🌟 **NEW REGION UNLOCKED:** ${ZONES[nextZoneIdx].name}!`, 'event');
      }
    }

    // Gauntlet Wave Progress
    if (this.isGauntlet) {
      this.player.gauntletHighScore = Math.max(this.player.gauntletHighScore || 0, this.gauntletWave);
      this.gauntletWave++;
    }

    // Check Level Up
    let leveledUp = false;
    while (this.player.xp >= this.getXpNeeded(this.player.level)) {
      this.player.xp -= this.getXpNeeded(this.player.level);
      this.player.level++;
      this.player.unallocatedPoints += 5;
      leveledUp = true;
    }

    if (leveledUp) {
      this.recalculatePlayerStats(true);
      window.soundEngine.levelUp();
      this.log(`⭐ **LEVEL UP!** You reached **Level ${this.player.level}**! +5 Stat Points granted!`, 'crit');
    }

    // Auto-save game
    await window.authManager.saveGame(this.player);

    if (window.onBattleEnd) {
      window.onBattleEnd('victory', {
        enemy: this.currentEnemy,
        xp: xpGained,
        gold: goldGained,
        leveledUp: leveledUp
      });
    }
  }

  // Defeat Resolution
  async handleDefeat() {
    this.inBattle = false;
    window.soundEngine.defeat();
    this.log(`☠️ You were vanquished by ${this.currentEnemy.name}...`, 'warn');

    // Revive at Inn with 50% HP and 50% MP
    this.player.hp = Math.floor(this.player.maxHp * 0.5);
    this.player.mp = Math.floor(this.player.maxMp * 0.5);

    if (window.onBattleEnd) {
      window.onBattleEnd('defeat', { enemy: this.currentEnemy });
    }
  }

  // Stat Point Allocation
  allocateStatPoint(statName) {
    if (!this.player || this.player.unallocatedPoints <= 0) return false;
    if (this.player.stats[statName] !== undefined) {
      this.player.stats[statName]++;
      this.player.unallocatedPoints--;
      this.recalculatePlayerStats(false);
      window.soundEngine.buy();
      window.authManager.saveGame(this.player);
      return true;
    }
    return false;
  }

  calculateElementalMultiplier(attackElem, enemyElem, enemyWeakness) {
    if (!attackElem) return 1.0;
    if (enemyWeakness && attackElem.toLowerCase() === enemyWeakness.toLowerCase()) {
      return 1.65;
    }
    const matrix = ELEMENT_ADVANTAGE[attackElem.toLowerCase()];
    if (matrix && enemyElem && matrix[enemyElem.toLowerCase()] !== undefined) {
      return matrix[enemyElem.toLowerCase()];
    }
    return 1.0;
  }

  log(msg, type = 'normal') {
    this.combatLogs.unshift({ msg, type, time: new Date().toLocaleTimeString() });
    if (this.combatLogs.length > 50) this.combatLogs.pop();
    if (window.renderCombatLogs) window.renderCombatLogs();
  }

  showDamageFloater(target, text, isCrit, elem) {
    if (window.displayDamageFloater) {
      window.displayDamageFloater(target, text, isCrit, elem);
    }
  }

  triggerScreenShake() {
    const el = document.getElementById('battle-arena');
    if (el) {
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 400);
    }
  }

  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
}

window.gameEngine = new GameEngine();
