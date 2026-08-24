// ============================================================================
// AetherQuest - Town Hub & Economy System (Battleon Haven)
// ============================================================================

class TownManager {
  constructor() {
    this.currentShopTab = 'weapons';
  }

  restAtInn() {
    const p = window.gameEngine.player;
    if (!p) return;

    p.hp = p.maxHp;
    p.mp = p.maxMp;
    window.soundEngine.heal();
    window.gameEngine.log(`🛏️ Rested at the Haven Inn! HP and MP fully restored.`, 'heal');
    window.authManager.saveGame(p);
    window.renderTownView();
    window.showToast('✨ Rested at the Inn! HP and MP fully restored.');
  }

  buyItem(itemId) {
    const p = window.gameEngine.player;
    if (!p) return;

    let item = WEAPONS[itemId] || ARMORS[itemId] || CONSUMABLES[itemId];
    let isSpell = false;
    if (!item && SPELLS[itemId]) {
      item = SPELLS[itemId];
      isSpell = true;
    }

    if (!item) return;

    const price = item.price || 0;
    if (p.gold < price) {
      window.showToast(`❌ Not enough Gold! (Need ${price} Gold)`);
      return;
    }

    if (item.reqLevel && p.level < item.reqLevel) {
      window.showToast(`❌ Requires Level ${item.reqLevel}!`);
      return;
    }

    if (isSpell) {
      if (p.spells.includes(itemId)) {
        window.showToast(`⚠️ You already know this spell!`);
        return;
      }
      p.gold -= price;
      p.spells.push(itemId);
      window.soundEngine.buy();
      window.showToast(`📖 Learned spell: ${item.name}!`);
    } else {
      p.gold -= price;
      p.inventory.push(itemId);
      window.soundEngine.buy();
      window.showToast(`🛒 Purchased ${item.name}!`);
    }

    window.authManager.saveGame(p);
    window.renderTownView();
  }

  sellItem(itemKey, index) {
    const p = window.gameEngine.player;
    if (!p) return;

    const item = WEAPONS[itemKey] || ARMORS[itemKey] || CONSUMABLES[itemKey];
    if (!item) return;

    const sellPrice = Math.max(5, Math.floor((item.price || 20) * 0.5));
    p.inventory.splice(index, 1);
    p.gold += sellPrice;

    window.soundEngine.buy();
    window.showToast(`💰 Sold ${item.name} for +${sellPrice} Gold!`);
    window.authManager.saveGame(p);
    window.renderTownView();
  }

  equipItem(itemKey) {
    const p = window.gameEngine.player;
    if (!p) return;

    const weapon = WEAPONS[itemKey];
    const armor = ARMORS[itemKey];

    if (weapon) {
      if (weapon.reqLevel && p.level < weapon.reqLevel) {
        window.showToast(`❌ Requires Level ${weapon.reqLevel} to equip!`);
        return;
      }
      p.equipped.weapon = itemKey;
      window.soundEngine.click();
      window.showToast(`🗡️ Equipped ${weapon.name}!`);
    } else if (armor) {
      if (armor.reqLevel && p.level < armor.reqLevel) {
        window.showToast(`❌ Requires Level ${armor.reqLevel} to equip!`);
        return;
      }
      p.equipped.armor = itemKey;
      window.soundEngine.click();
      window.showToast(`🛡️ Donned ${armor.name}!`);
    }

    window.gameEngine.recalculatePlayerStats(false);
    window.authManager.saveGame(p);
    window.renderTownView();
  }
}

window.townManager = new TownManager();
