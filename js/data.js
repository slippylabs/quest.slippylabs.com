// ============================================================================
// AetherQuest - Core Game Database & System Constants
// Inspired by AdventureQuest (BattleOn) / Turn-Based High-Fantasy JRPG
// ============================================================================

const ELEMENTS = {
  PHYSICAL: { id: 'physical', name: 'Physical', icon: '⚔️', color: '#e0e0e0' },
  FIRE:     { id: 'fire',     name: 'Fire',     icon: '🔥', color: '#ff5722' },
  WATER:    { id: 'water',    name: 'Water/Ice',icon: '💧', color: '#00bcd4' },
  EARTH:    { id: 'earth',    name: 'Earth',    icon: '🌿', color: '#8bc34a' },
  LIGHTNING:{ id: 'lightning',name: 'Lightning',icon: '⚡', color: '#ffeb3b' },
  LIGHT:    { id: 'light',    name: 'Light',    icon: '✨', color: '#ffd700' },
  DARKNESS: { id: 'darkness', name: 'Darkness', icon: '🌑', color: '#ab47bc' },
  ARCANE:   { id: 'arcane',   name: 'Arcane',   icon: '🔮', color: '#9c27b0' }
};

// Elemental Advantage Matrix
// Multipliers applied when attackElement hits a target with certain vulnerabilities
const ELEMENT_ADVANTAGE = {
  fire:      { water: 0.65, earth: 1.50, physical: 1.0, light: 1.0, darkness: 1.25, lightning: 1.0, arcane: 1.0, fire: 0.5 },
  water:     { fire: 1.60, lightning: 0.65, earth: 1.0, physical: 1.0, light: 1.0, darkness: 1.0, arcane: 1.0, water: 0.5 },
  earth:     { lightning: 1.55, fire: 0.70, water: 1.15, physical: 1.0, light: 1.0, darkness: 1.0, arcane: 1.0, earth: 0.5 },
  lightning: { water: 1.60, earth: 0.65, fire: 1.0, physical: 1.0, light: 1.0, darkness: 1.0, arcane: 1.0, lightning: 0.5 },
  light:     { darkness: 1.75, light: 0.5, fire: 1.1, water: 1.0, earth: 1.0, lightning: 1.0, physical: 1.0, arcane: 1.0 },
  darkness:  { light: 1.50, darkness: 0.5, physical: 1.1, fire: 1.0, water: 1.0, earth: 1.0, lightning: 1.0, arcane: 1.0 },
  arcane:    { physical: 1.15, fire: 1.15, water: 1.15, earth: 1.15, lightning: 1.15, light: 1.15, darkness: 1.15, arcane: 0.8 },
  physical:  { physical: 1.0, fire: 1.0, water: 1.0, earth: 1.0, lightning: 1.0, light: 1.0, darkness: 1.0, arcane: 1.0 }
};

const CLASSES = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    icon: '🛡️',
    description: 'Master of heavy arms and resolute armor. Crushes foes with devastating physical strikes.',
    baseStats: { str: 14, dex: 10, int: 7, end: 14, luk: 9 },
    statGrowths: { hp: 18, mp: 6 },
    passive: '+15% Physical Weapon Damage & +12% Max Health',
    starterWeapon: 'iron_sword',
    starterArmor: 'bronze_plate',
    skills: ['power_strike', 'shield_wall', 'whirlwind']
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    icon: '🧙‍♂️',
    description: 'Wielder of primal elemental forces. Conjures firestorms, blizzards, and arcane devastation.',
    baseStats: { str: 6, dex: 9, int: 17, end: 9, luk: 10 },
    statGrowths: { hp: 11, mp: 16 },
    passive: '+25% Spell Damage & +25 Max Mana',
    starterWeapon: 'apprentice_wand',
    starterArmor: 'mystic_robe',
    skills: ['fireball', 'mana_shield', 'arcane_blast']
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    icon: '🗡️',
    description: 'Lethal shadow stalker. Masters high critical strikes, evasion, and crippling poisons.',
    baseStats: { str: 10, dex: 16, int: 8, end: 10, luk: 15 },
    statGrowths: { hp: 13, mp: 9 },
    passive: '+18% Critical Hit Chance & +12% Evasion Rate',
    starterWeapon: 'shadow_daggers',
    starterArmor: 'leather_tunic',
    skills: ['poison_strike', 'shadow_step', 'blade_flurry']
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    icon: '⚔️',
    description: 'Holy crusader of radiant light. Vanquishes unholy fiends with blessed strikes and divine aegis.',
    baseStats: { str: 12, dex: 8, int: 12, end: 13, luk: 10 },
    statGrowths: { hp: 16, mp: 12 },
    passive: '+25% Holy Light Damage & +15% Damage Reduction vs Darkness',
    starterWeapon: 'blessed_mace',
    starterArmor: 'templar_chain',
    skills: ['holy_smite', 'radiant_heal', 'divine_judgement']
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    icon: '💀',
    description: 'Master of forbidden shadow sorcery. Siphons life essence and afflicts enemies with decay.',
    baseStats: { str: 7, dex: 8, int: 16, end: 11, luk: 11 },
    statGrowths: { hp: 13, mp: 14 },
    passive: '+20% Darkness Damage & 12% Life Steal on Spell Damage',
    starterWeapon: 'bone_scythe',
    starterArmor: 'grave_shroud',
    skills: ['soul_siphon', 'plague_curse', 'death_nova']
  }
};

// Weapons Catalog (30 items)
const WEAPONS = {
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Broadsword',
    type: 'weapon',
    weaponType: 'sword',
    element: 'physical',
    attack: 14,
    critBonus: 0,
    price: 0,
    reqLevel: 1,
    icon: '🗡️',
    description: 'Standard forged steel blade. Reliable and sharp.'
  },
  apprentice_wand: {
    id: 'apprentice_wand',
    name: 'Apprentice Wand',
    type: 'weapon',
    weaponType: 'wand',
    element: 'arcane',
    attack: 10,
    magicBonus: 8,
    price: 0,
    reqLevel: 1,
    icon: '🪄',
    description: 'Carved elder wood channeling basic arcane pulses.'
  },
  shadow_daggers: {
    id: 'shadow_daggers',
    name: 'Twin Daggers',
    type: 'weapon',
    weaponType: 'dagger',
    element: 'physical',
    attack: 11,
    critBonus: 8,
    price: 0,
    reqLevel: 1,
    icon: '🗡️',
    description: 'Matched lightweight blades weighted for precise critical strikes.'
  },
  blessed_mace: {
    id: 'blessed_mace',
    name: 'Blessed Mace',
    type: 'weapon',
    weaponType: 'mace',
    element: 'light',
    attack: 12,
    magicBonus: 5,
    price: 0,
    reqLevel: 1,
    icon: '🔨',
    description: 'Infused with temple holy water, punishing dark creatures.'
  },
  bone_scythe: {
    id: 'bone_scythe',
    name: 'Bone Scythe',
    type: 'weapon',
    weaponType: 'scythe',
    element: 'darkness',
    attack: 12,
    magicBonus: 6,
    price: 0,
    reqLevel: 1,
    icon: '☠️',
    description: 'Harvests life energy from wounded enemies.'
  },
  flame_brand: {
    id: 'flame_brand',
    name: 'Flamebrand Blade',
    type: 'weapon',
    weaponType: 'sword',
    element: 'fire',
    attack: 24,
    critBonus: 4,
    price: 160,
    reqLevel: 4,
    icon: '🔥',
    description: 'A glowing blade tempered in molten lava.'
  },
  frost_edge: {
    id: 'frost_edge',
    name: 'Frostbite Rapier',
    type: 'weapon',
    weaponType: 'dagger',
    element: 'water',
    attack: 26,
    critBonus: 10,
    price: 220,
    reqLevel: 6,
    icon: '❄️',
    description: 'Chilled steel that bites deeper with rapid thrusts.'
  },
  thunder_hammer: {
    id: 'thunder_hammer',
    name: 'Thunder Hammer',
    type: 'weapon',
    weaponType: 'mace',
    element: 'lightning',
    attack: 38,
    critBonus: 5,
    price: 450,
    reqLevel: 9,
    icon: '⚡',
    description: 'Crackles with violent electrical voltage on impact.'
  },
  verdant_bow: {
    id: 'verdant_bow',
    name: 'Verdant Longbow',
    type: 'weapon',
    weaponType: 'bow',
    element: 'earth',
    attack: 36,
    critBonus: 12,
    price: 420,
    reqLevel: 8,
    icon: '🏹',
    description: 'Crafted by elven fletchers from living ironwood.'
  },
  archmage_staff: {
    id: 'archmage_staff',
    name: 'Archmage Staff',
    type: 'weapon',
    weaponType: 'staff',
    element: 'arcane',
    attack: 28,
    magicBonus: 32,
    price: 680,
    reqLevel: 12,
    icon: '🔮',
    description: 'Crown jewel of the arcane academy. Amplifies spellpower.'
  },
  sunfire_greatsword: {
    id: 'sunfire_greatsword',
    name: 'Sunfire Greatsword',
    type: 'weapon',
    weaponType: 'greatsword',
    element: 'light',
    attack: 58,
    critBonus: 8,
    price: 1100,
    reqLevel: 15,
    icon: '☀️',
    description: 'Radiates blinding solar heat that decimates the undead.'
  },
  dread_scythe: {
    id: 'dread_scythe',
    name: 'Dread Scythe of Souls',
    type: 'weapon',
    weaponType: 'scythe',
    element: 'darkness',
    attack: 54,
    magicBonus: 28,
    price: 1250,
    reqLevel: 17,
    icon: '💀',
    description: 'Forged in the abyss, dripping with shadowy necrotic venom.'
  },
  glacier_cleaver: {
    id: 'glacier_cleaver',
    name: 'Glacier Cleaver',
    type: 'weapon',
    weaponType: 'axe',
    element: 'water',
    attack: 68,
    critBonus: 6,
    price: 1750,
    reqLevel: 21,
    icon: '🪓',
    description: 'Carved from primordial iceberg crystal. Freezes wounds solid.'
  },
  stormcaller_bow: {
    id: 'stormcaller_bow',
    name: 'Stormcaller Bow',
    type: 'weapon',
    weaponType: 'bow',
    element: 'lightning',
    attack: 66,
    critBonus: 16,
    price: 1900,
    reqLevel: 23,
    icon: '🏹',
    description: 'Arrows fly wrapped in thunderous howling gale winds.'
  },
  void_reaver: {
    id: 'void_reaver',
    name: 'Void Reaver Blade',
    type: 'weapon',
    weaponType: 'sword',
    element: 'arcane',
    attack: 88,
    magicBonus: 40,
    critBonus: 12,
    price: 3200,
    reqLevel: 28,
    icon: '🌌',
    description: 'A rift blade that cuts through physical reality itself.'
  },
  excalibur_aether: {
    id: 'excalibur_aether',
    name: 'Excalibur of Aether',
    type: 'weapon',
    weaponType: 'greatsword',
    element: 'light',
    attack: 115,
    magicBonus: 45,
    critBonus: 18,
    price: 5500,
    reqLevel: 35,
    icon: '👑',
    description: 'The legendary sovereign blade. Ultimate weapon of Lore.'
  }
};

// Armors & Robes Catalog (20 items)
const ARMORS = {
  bronze_plate: {
    id: 'bronze_plate',
    name: 'Bronze Plate Armor',
    type: 'armor',
    defense: 8,
    resistances: { physical: 0.10, fire: 0.05, water: 0.0, earth: 0.05, lightning: -0.10, light: 0.0, darkness: 0.0, arcane: 0.0 },
    price: 0,
    reqLevel: 1,
    icon: '🛡️',
    description: 'Sturdy bronze cuirass offering solid physical protection.'
  },
  mystic_robe: {
    id: 'mystic_robe',
    name: 'Mystic Robes',
    type: 'armor',
    defense: 4,
    magicDefense: 10,
    resistances: { physical: 0.0, fire: 0.10, water: 0.10, earth: 0.10, lightning: 0.10, light: 0.10, darkness: 0.10, arcane: 0.15 },
    price: 0,
    reqLevel: 1,
    icon: '🥋',
    description: 'Enchanted silk woven with arcane warding sigils.'
  },
  leather_tunic: {
    id: 'leather_tunic',
    name: 'Ranger Leather Tunic',
    type: 'armor',
    defense: 6,
    dodgeBonus: 6,
    resistances: { physical: 0.05, fire: 0.0, water: 0.05, earth: 0.10, lightning: 0.05, light: 0.0, darkness: 0.0, arcane: 0.0 },
    price: 0,
    reqLevel: 1,
    icon: '🦺',
    description: 'Supple wolf hide allowing uninhibited agile movement.'
  },
  templar_chain: {
    id: 'templar_chain',
    name: 'Templar Chainmail',
    type: 'armor',
    defense: 7,
    magicDefense: 7,
    resistances: { physical: 0.08, fire: 0.05, water: 0.0, earth: 0.0, lightning: 0.0, light: 0.20, darkness: 0.15, arcane: 0.0 },
    price: 0,
    reqLevel: 1,
    icon: '⛓️',
    description: 'Sanctified chain links blessed by high clerics.'
  },
  grave_shroud: {
    id: 'grave_shroud',
    name: 'Grave Shroud',
    type: 'armor',
    defense: 5,
    magicDefense: 9,
    resistances: { physical: 0.0, fire: -0.10, water: 0.05, earth: 0.05, lightning: 0.0, light: -0.15, darkness: 0.30, arcane: 0.10 },
    price: 0,
    reqLevel: 1,
    icon: '🥻',
    description: 'Imbued with the chilling essence of the netherworld.'
  },
  salamander_mail: {
    id: 'salamander_mail',
    name: 'Salamander Scale Mail',
    type: 'armor',
    defense: 16,
    resistances: { physical: 0.12, fire: 0.40, water: -0.15, earth: 0.10, lightning: 0.0, light: 0.0, darkness: 0.0, arcane: 0.05 },
    price: 240,
    reqLevel: 5,
    icon: '🔥',
    description: 'Scales from fire salamanders that shrug off intense heat.'
  },
  frost_carapace: {
    id: 'frost_carapace',
    name: 'Glacial Plate',
    type: 'armor',
    defense: 22,
    resistances: { physical: 0.15, fire: -0.20, water: 0.45, earth: 0.05, lightning: 0.0, light: 0.05, darkness: 0.0, arcane: 0.05 },
    price: 480,
    reqLevel: 9,
    icon: '❄️',
    description: 'Armor of perpetual frost, absorbing ice and water strikes.'
  },
  storm_drifter_garb: {
    id: 'storm_drifter_garb',
    name: 'Stormdrifter Cloak',
    type: 'armor',
    defense: 18,
    dodgeBonus: 10,
    resistances: { physical: 0.10, fire: 0.05, water: 0.10, earth: -0.15, lightning: 0.45, light: 0.05, darkness: 0.0, arcane: 0.05 },
    price: 850,
    reqLevel: 14,
    icon: '⚡',
    description: 'Woven with tempest fibers, insulating against electric shocks.'
  },
  aegis_of_valor: {
    id: 'aegis_of_valor',
    name: 'Aegis of Valor',
    type: 'armor',
    defense: 35,
    magicDefense: 20,
    resistances: { physical: 0.22, fire: 0.15, water: 0.15, earth: 0.15, lightning: 0.15, light: 0.35, darkness: 0.25, arcane: 0.15 },
    price: 2100,
    reqLevel: 22,
    icon: '🛡️',
    description: 'Heavy plate armor worn by high champions of the realm.'
  },
  void_dreadplate: {
    id: 'void_dreadplate',
    name: 'Void Sovereign Dreadplate',
    type: 'armor',
    defense: 52,
    magicDefense: 35,
    resistances: { physical: 0.30, fire: 0.25, water: 0.25, earth: 0.25, lightning: 0.25, light: 0.10, darkness: 0.45, arcane: 0.40 },
    price: 4800,
    reqLevel: 32,
    icon: '🌌',
    description: 'Forged from fallen stars and void alloy. Impregnable defense.'
  }
};

// Spells & Combat Abilities Catalog
const SPELLS = {
  // Warrior Skills
  power_strike: {
    id: 'power_strike',
    name: 'Power Strike',
    type: 'skill',
    element: 'physical',
    mpCost: 12,
    damageMult: 1.85,
    stunChance: 0.25,
    icon: '💥',
    description: 'A crushing blow that deals 185% physical weapon damage with a 25% stun chance.'
  },
  shield_wall: {
    id: 'shield_wall',
    name: 'Shield Wall',
    type: 'skill',
    element: 'physical',
    mpCost: 16,
    buff: { type: 'shield', turns: 2, value: 0.50 },
    icon: '🛡️',
    description: 'Raise defensive guard, reducing incoming damage by 50% for 2 turns.'
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind Cleave',
    type: 'skill',
    element: 'physical',
    mpCost: 24,
    damageMult: 2.2,
    bleed: { turns: 3, percent: 0.15 },
    icon: '🌪️',
    description: 'Sweeps weapon in a lethal circle, dealing 220% dmg and causing bleed.'
  },

  // Mage Spells
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    type: 'spell',
    element: 'fire',
    mpCost: 15,
    basePower: 35,
    burn: { turns: 3, dmg: 12 },
    icon: '🔥',
    description: 'Hurls an explosive sphere of fire that burns targets over 3 turns.'
  },
  mana_shield: {
    id: 'mana_shield',
    name: 'Mana Shield',
    type: 'spell',
    element: 'arcane',
    mpCost: 20,
    buff: { type: 'barrier', turns: 3, value: 75 },
    icon: '🔮',
    description: 'Creates a magical barrier absorbing up to 75 damage.'
  },
  arcane_blast: {
    id: 'arcane_blast',
    name: 'Arcane Blast',
    type: 'spell',
    element: 'arcane',
    mpCost: 28,
    basePower: 65,
    icon: '💫',
    description: 'Concentrated pure arcane energy obliterating enemy defenses.'
  },
  frost_nova: {
    id: 'frost_nova',
    name: 'Frost Nova',
    type: 'spell',
    element: 'water',
    mpCost: 22,
    basePower: 45,
    freezeChance: 0.40,
    icon: '❄️',
    description: 'Erupts an icy blast dealing water damage with a 40% chance to freeze.'
  },
  thunderstorm: {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    type: 'spell',
    element: 'lightning',
    mpCost: 35,
    basePower: 80,
    shockChance: 0.35,
    icon: '⚡',
    description: 'Calls down thunderbolts that shock and devastate the target.'
  },

  // Rogue Skills
  poison_strike: {
    id: 'poison_strike',
    name: 'Poison Strike',
    type: 'skill',
    element: 'earth',
    mpCost: 12,
    damageMult: 1.4,
    poison: { turns: 4, dmg: 14 },
    icon: '🧪',
    description: 'Coats blade in venom dealing strike damage and heavy poison over 4 turns.'
  },
  shadow_step: {
    id: 'shadow_step',
    name: 'Shadowstep',
    type: 'skill',
    element: 'darkness',
    mpCost: 18,
    buff: { type: 'dodge', turns: 2, value: 0.65 },
    icon: '👥',
    description: 'Vanish into shadows, boosting evasion by 65% for 2 turns.'
  },
  blade_flurry: {
    id: 'blade_flurry',
    name: 'Blade Flurry',
    type: 'skill',
    element: 'physical',
    mpCost: 26,
    hits: 3,
    damageMultPerHit: 0.85,
    critBonus: 15,
    icon: '⚔️',
    description: 'Unleashes 3 rapid critical-enhanced strikes.'
  },

  // Paladin Skills
  holy_smite: {
    id: 'holy_smite',
    name: 'Holy Smite',
    type: 'spell',
    element: 'light',
    mpCost: 18,
    basePower: 42,
    undeadBonus: 1.75,
    icon: '✨',
    description: 'Calls celestial radiance. Deals massive bonus damage against undead & dark foes.'
  },
  radiant_heal: {
    id: 'radiant_heal',
    name: 'Radiant Heal',
    type: 'spell',
    element: 'light',
    mpCost: 22,
    healPower: 70,
    icon: '💖',
    description: 'Channels holy prayer to restore 70+ HP based on Intellect.'
  },
  divine_judgement: {
    id: 'divine_judgement',
    name: 'Divine Judgement',
    type: 'spell',
    element: 'light',
    mpCost: 40,
    basePower: 95,
    icon: '🌟',
    description: 'The supreme wrath of the heavens. Deals colossal Light damage.'
  },

  // Necromancer Skills
  soul_siphon: {
    id: 'soul_siphon',
    name: 'Soul Siphon',
    type: 'spell',
    element: 'darkness',
    mpCost: 16,
    basePower: 38,
    drainPercent: 0.50,
    icon: '🩸',
    description: 'Drains life essence from the enemy, healing the caster for 50% of damage dealt.'
  },
  plague_curse: {
    id: 'plague_curse',
    name: 'Plague Curse',
    type: 'spell',
    element: 'darkness',
    mpCost: 24,
    basePower: 30,
    decay: { turns: 4, dmg: 18 },
    icon: '☣️',
    description: 'Afflicts target with necrotic disease that corrupts health every turn.'
  },
  death_nova: {
    id: 'death_nova',
    name: 'Death Nova',
    type: 'spell',
    element: 'darkness',
    mpCost: 38,
    basePower: 90,
    icon: '💀',
    description: 'Unleashes an explosion of spectral skulls and nether energy.'
  }
};

// Consumables & Potions
const CONSUMABLES = {
  health_potion_s: {
    id: 'health_potion_s',
    name: 'Minor Health Potion',
    type: 'consumable',
    effect: 'heal',
    value: 60,
    price: 25,
    icon: '🧪',
    description: 'Restores 60 Health Points instantly.'
  },
  health_potion_m: {
    id: 'health_potion_m',
    name: 'Major Health Potion',
    type: 'consumable',
    effect: 'heal',
    value: 160,
    price: 75,
    icon: '🧪',
    description: 'Restores 160 Health Points instantly.'
  },
  health_potion_l: {
    id: 'health_potion_l',
    name: 'Elixir of Full Vitality',
    type: 'consumable',
    effect: 'heal',
    value: 400,
    price: 200,
    icon: '💖',
    description: 'Restores 400 Health Points instantly.'
  },
  mana_potion_s: {
    id: 'mana_potion_s',
    name: 'Minor Mana Potion',
    type: 'consumable',
    effect: 'mana',
    value: 45,
    price: 30,
    icon: '🧪',
    description: 'Restores 45 Mana Points instantly.'
  },
  mana_potion_m: {
    id: 'mana_potion_m',
    name: 'Major Mana Potion',
    type: 'consumable',
    effect: 'mana',
    value: 120,
    price: 85,
    icon: '🧪',
    description: 'Restores 120 Mana Points instantly.'
  },
  elixir_might: {
    id: 'elixir_might',
    name: 'Elixir of Might',
    type: 'consumable',
    effect: 'buff_str',
    value: 10,
    turns: 4,
    price: 90,
    icon: '🍷',
    description: 'Temporarily boosts attack power for 4 combat turns.'
  },
  antidote: {
    id: 'antidote',
    name: 'Cleansing Draught',
    type: 'consumable',
    effect: 'cleanse',
    price: 40,
    icon: '🧴',
    description: 'Cures all active poisons, burns, and bleed status effects.'
  },
  fire_bomb: {
    id: 'fire_bomb',
    name: 'Alchemist Fire Bomb',
    type: 'consumable',
    effect: 'damage',
    element: 'fire',
    value: 110,
    price: 80,
    icon: '💣',
    description: 'Explodes dealing 110 flat Fire damage to the foe.'
  }
};

// Quest Zones & Locations
const ZONES = [
  {
    id: 'wilds',
    name: 'Whispering Wilds',
    recommendedLevel: '1 - 6',
    minLevel: 1,
    icon: '🌲',
    bgTheme: 'forest',
    description: 'Dense ancient woods teeming with goblin raiders, dire wolves, and corrupted treants.',
    enemies: ['goblin_thief', 'timber_wolf', 'thorn_treant'],
    boss: 'goblin_king',
    bossName: 'Gorzok the Goblin Warlord'
  },
  {
    id: 'frostpeak',
    name: 'Frostpeak Caverns',
    recommendedLevel: '7 - 12',
    minLevel: 7,
    icon: '🏔️',
    bgTheme: 'ice',
    description: 'Frozen glacial cavern system infested with frost drakes and crystalline ice golems.',
    enemies: ['frost_spider', 'ice_golem', 'yeti_bruiser'],
    boss: 'frost_drake',
    bossName: 'Cryoza the Frost Dragon'
  },
  {
    id: 'magma',
    name: 'Molten Depths',
    recommendedLevel: '13 - 18',
    minLevel: 13,
    icon: '🌋',
    bgTheme: 'volcano',
    description: 'Subterranean lava rivers guarded by blazing elementals and infernal berserkers.',
    enemies: ['magma_salamander', 'fire_elemental', 'infernal_berserker'],
    boss: 'pyro_lord',
    bossName: 'Ignis the Fire Overlord'
  },
  {
    id: 'crypts',
    name: 'Cursed Necropolis',
    recommendedLevel: '19 - 25',
    minLevel: 19,
    icon: '🏛️',
    bgTheme: 'crypt',
    description: 'Ancient tombs where restless skeletal legions and shrieking banshees wander.',
    enemies: ['skeletal_warrior', 'dread_banshee', 'lich_adept'],
    boss: 'lord_malakor',
    bossName: 'Lord Malakor the Undying Lich'
  },
  {
    id: 'tempest',
    name: 'Tempest Spire',
    recommendedLevel: '26 - 33',
    minLevel: 26,
    icon: '⚡',
    bgTheme: 'storm',
    description: 'A floating citadel pierced by eternal lightning storms and storm harpies.',
    enemies: ['storm_harpy', 'thunder_djinn', 'sky_golem'],
    boss: 'valkyrie_queen',
    bossName: 'Astraea the Storm Sovereign'
  },
  {
    id: 'void',
    name: 'The Void Rift',
    recommendedLevel: '34 - 50+',
    minLevel: 34,
    icon: '🌌',
    bgTheme: 'void',
    description: 'The shattered edge of reality. Home to ancient cosmic abominations and the Nether Dragon.',
    enemies: ['void_spawn', 'abyssal_reaper', 'shadow_behemoth'],
    boss: 'void_emperor',
    bossName: 'Zaxas the Void Emperor'
  },
  {
    id: 'gauntlet',
    name: 'Endless Battle Gauntlet',
    recommendedLevel: 'Dynamic (Scales to your level)',
    minLevel: 1,
    icon: '🏆',
    bgTheme: 'arena',
    description: 'An endless tournament arena against dynamically scaling champion monsters with rare loot.',
    isGauntlet: true
  }
];

// Bestiary & Monster Templates
const MONSTER_TEMPLATES = {
  // Whispering Wilds
  goblin_thief: {
    name: 'Goblin Pillager',
    element: 'earth',
    icon: '👺',
    baseHp: 45,
    baseAtk: 9,
    baseDef: 3,
    xpReward: 35,
    goldReward: 20,
    skills: ['quick_stab', 'dirt_throw'],
    description: 'A sneaky goblin with a rusty dagger looking for an easy mark.'
  },
  timber_wolf: {
    name: 'Dire Forest Wolf',
    element: 'earth',
    icon: '🐺',
    baseHp: 55,
    baseAtk: 12,
    baseDef: 4,
    xpReward: 45,
    goldReward: 25,
    skills: ['feral_bite', 'howl'],
    description: 'Savage predator hunting in the thick forest canopy.'
  },
  thorn_treant: {
    name: 'Corrupted Treant',
    element: 'earth',
    weakness: 'fire',
    icon: '🌲',
    baseHp: 85,
    baseAtk: 14,
    baseDef: 8,
    xpReward: 65,
    goldReward: 35,
    skills: ['root_crush'],
    description: 'An ancient animated tree twisted by dark magic.'
  },
  goblin_king: {
    name: 'Gorzok the Goblin Warlord',
    tier: 'boss',
    element: 'earth',
    icon: '👑',
    baseHp: 220,
    baseAtk: 24,
    baseDef: 12,
    xpReward: 320,
    goldReward: 220,
    skills: ['warlord_smash', 'rallying_cry'],
    description: 'Chieftain of the forest goblin clans wielding a massive stone club.'
  },

  // Frostpeak Caverns
  frost_spider: {
    name: 'Frostfang Arachnid',
    element: 'water',
    weakness: 'fire',
    icon: '🕷️',
    baseHp: 110,
    baseAtk: 22,
    baseDef: 8,
    xpReward: 110,
    goldReward: 55,
    skills: ['frost_venom', 'web_wrap'],
    description: 'Glacial spider that paralyzes its prey with freezing venom.'
  },
  ice_golem: {
    name: 'Glacier Golem',
    element: 'water',
    weakness: 'fire',
    icon: '🗿',
    baseHp: 160,
    baseAtk: 26,
    baseDef: 18,
    xpReward: 150,
    goldReward: 70,
    skills: ['ice_slam', 'crystallize'],
    description: 'Construct formed from ancient unmelting ice crystal.'
  },
  yeti_bruiser: {
    name: 'Frostpeak Yeti',
    element: 'water',
    weakness: 'fire',
    icon: '🦍',
    baseHp: 190,
    baseAtk: 32,
    baseDef: 14,
    xpReward: 180,
    goldReward: 90,
    skills: ['ground_pound', 'avalanche'],
    description: 'Towering beast reigning over the snowy peaks.'
  },
  frost_drake: {
    name: 'Cryoza the Frost Dragon',
    tier: 'boss',
    element: 'water',
    weakness: 'fire',
    icon: '🐉',
    baseHp: 480,
    baseAtk: 48,
    baseDef: 24,
    xpReward: 750,
    goldReward: 480,
    skills: ['blizzard_breath', 'glacial_tail_whip'],
    description: 'Ancient frost dragon whose breath chills blood to stone.'
  },

  // Molten Depths
  magma_salamander: {
    name: 'Magma Salamander',
    element: 'fire',
    weakness: 'water',
    icon: '🦎',
    baseHp: 210,
    baseAtk: 38,
    baseDef: 16,
    xpReward: 240,
    goldReward: 110,
    skills: ['flame_spit', 'tail_swipe'],
    description: 'Lava reptile swimming through boiling rock.'
  },
  fire_elemental: {
    name: 'Blazing Elemental',
    element: 'fire',
    weakness: 'water',
    icon: '🔥',
    baseHp: 240,
    baseAtk: 44,
    baseDef: 14,
    xpReward: 290,
    goldReward: 135,
    skills: ['fire_blast', 'inferno_surge'],
    description: 'Living manifestation of pure primordial flame.'
  },
  infernal_berserker: {
    name: 'Infernal Berserker',
    element: 'fire',
    weakness: 'water',
    icon: '👹',
    baseHp: 290,
    baseAtk: 52,
    baseDef: 20,
    xpReward: 350,
    goldReward: 160,
    skills: ['flame_strike', 'blood_rage'],
    description: 'Fanatical warrior wielding dual burning scimitars.'
  },
  pyro_lord: {
    name: 'Ignis the Fire Overlord',
    tier: 'boss',
    element: 'fire',
    weakness: 'water',
    icon: '🌋',
    baseHp: 850,
    baseAtk: 72,
    baseDef: 30,
    xpReward: 1400,
    goldReward: 900,
    skills: ['cataclysmic_meteor', 'molten_shield'],
    description: 'Lord of the volcano capable of summoning raining meteors.'
  },

  // Cursed Necropolis
  skeletal_warrior: {
    name: 'Dread Sentry',
    element: 'darkness',
    weakness: 'light',
    icon: '💀',
    baseHp: 320,
    baseAtk: 58,
    baseDef: 24,
    xpReward: 420,
    goldReward: 190,
    skills: ['shadow_strike', 'bone_shield'],
    description: 'Undead guard risen from centuries of slumber.'
  },
  dread_banshee: {
    name: 'Wailing Banshee',
    element: 'darkness',
    weakness: 'light',
    icon: '👻',
    baseHp: 310,
    baseAtk: 65,
    baseDef: 16,
    xpReward: 480,
    goldReward: 220,
    skills: ['death_shriek', 'terror_gaze'],
    description: 'Incorporeal specter whose cries shatter mortal minds.'
  },
  lich_adept: {
    name: 'Necro-Lich Adept',
    element: 'darkness',
    weakness: 'light',
    icon: '🧙‍♂️',
    baseHp: 370,
    baseAtk: 72,
    baseDef: 22,
    xpReward: 560,
    goldReward: 260,
    skills: ['dark_decay', 'shadow_bolt'],
    description: 'Sorcerer of unlife casting forbidden soul curses.'
  },
  lord_malakor: {
    name: 'Lord Malakor the Undying',
    tier: 'boss',
    element: 'darkness',
    weakness: 'light',
    icon: '☠️',
    baseHp: 1350,
    baseAtk: 95,
    baseDef: 40,
    xpReward: 2600,
    goldReward: 1600,
    skills: ['grim_harvest', 'army_of_the_dead', 'soul_rend'],
    description: 'Supreme necromancer lord ruler of the crypts.'
  },

  // Tempest Spire
  storm_harpy: {
    name: 'Tempest Harpy',
    element: 'lightning',
    weakness: 'earth',
    icon: '🦅',
    baseHp: 440,
    baseAtk: 84,
    baseDef: 26,
    xpReward: 680,
    goldReward: 310,
    skills: ['lightning_dive', 'gust'],
    description: 'Winged creature diving with electrical talons.'
  },
  thunder_djinn: {
    name: 'Thunder Djinn',
    element: 'lightning',
    weakness: 'earth',
    icon: '🧞',
    baseHp: 510,
    baseAtk: 96,
    baseDef: 30,
    xpReward: 820,
    goldReward: 380,
    skills: ['ball_lightning', 'static_shock'],
    description: 'Genie of storm winds and lightning surges.'
  },
  sky_golem: {
    name: 'Aether Cloud Golem',
    element: 'lightning',
    weakness: 'earth',
    icon: '🌩️',
    baseHp: 640,
    baseAtk: 104,
    baseDef: 42,
    xpReward: 950,
    goldReward: 440,
    skills: ['thunder_smash', 'charged_armor'],
    description: 'Animated colossal cloud stone charged with thousands of volts.'
  },
  valkyrie_queen: {
    name: 'Astraea the Storm Sovereign',
    tier: 'boss',
    element: 'lightning',
    weakness: 'earth',
    icon: '⚡',
    baseHp: 2100,
    baseAtk: 130,
    baseDef: 50,
    xpReward: 4200,
    goldReward: 2500,
    skills: ['spear_of_judgement', 'wrath_of_the_skies', 'zephyr_barrier'],
    description: 'Celestial warrior commanding the skies with her lightning spear.'
  },

  // The Void Rift
  void_spawn: {
    name: 'Void Crawler',
    element: 'arcane',
    icon: '👾',
    baseHp: 680,
    baseAtk: 120,
    baseDef: 38,
    xpReward: 1200,
    goldReward: 520,
    skills: ['void_bite', 'phase_shift'],
    description: 'Eldritch creature born from nothingness.'
  },
  abyssal_reaper: {
    name: 'Abyssal Dread Reaper',
    element: 'arcane',
    icon: '⚔️',
    baseHp: 820,
    baseAtk: 142,
    baseDef: 45,
    xpReward: 1550,
    goldReward: 680,
    skills: ['oblivion_slash', 'null_field'],
    description: 'Executioner of lost souls in the cosmic rift.'
  },
  shadow_behemoth: {
    name: 'Void Behemoth',
    element: 'arcane',
    icon: '👿',
    baseHp: 1100,
    baseAtk: 165,
    baseDef: 58,
    xpReward: 2100,
    goldReward: 850,
    skills: ['cosmic_crush', 'singularity'],
    description: 'Titan of dark matter crushing all living energy.'
  },
  void_emperor: {
    name: 'Zaxas the Void Emperor',
    tier: 'boss',
    element: 'arcane',
    icon: '🌌',
    baseHp: 3800,
    baseAtk: 195,
    baseDef: 70,
    xpReward: 9999,
    goldReward: 6000,
    skills: ['cosmic_extinction', 'dimensional_tear', 'void_shield', 'astral_drain'],
    description: 'The ancient lord of the void who threatens to consume Lore itself.'
  }
};

// Scaled Enemy Generator Function
function generateScaledMonster(templateKey, playerLevel, isGauntlet = false, gauntletWave = 1) {
  const template = MONSTER_TEMPLATES[templateKey] || MONSTER_TEMPLATES['goblin_thief'];
  const lvl = isGauntlet ? Math.max(playerLevel, gauntletWave) : Math.max(1, playerLevel);
  
  const isBoss = template.tier === 'boss';
  const tierMult = isBoss ? 2.5 : 1.0;
  
  const scaledHp = Math.round(template.baseHp * (1 + (lvl - 1) * 0.18) * (isGauntlet ? (1 + gauntletWave * 0.08) : 1));
  const scaledAtk = Math.round(template.baseAtk * (1 + (lvl - 1) * 0.14) * (isGauntlet ? (1 + gauntletWave * 0.05) : 1));
  const scaledDef = Math.round(template.baseDef * (1 + (lvl - 1) * 0.12));
  const scaledXp = Math.round(template.xpReward * (1 + (lvl - 1) * 0.22) * (isGauntlet ? 1.3 : 1));
  const scaledGold = Math.round(template.goldReward * (1 + (lvl - 1) * 0.20) * (isGauntlet ? 1.4 : 1));

  return {
    id: templateKey,
    name: isGauntlet ? `[Wave ${gauntletWave}] ${template.name}` : template.name,
    icon: template.icon,
    element: template.element,
    weakness: template.weakness,
    level: lvl,
    maxHp: scaledHp,
    currentHp: scaledHp,
    attack: scaledAtk,
    defense: scaledDef,
    xpReward: scaledXp,
    goldReward: scaledGold,
    isBoss: isBoss,
    skills: template.skills || [],
    description: template.description
  };
}
