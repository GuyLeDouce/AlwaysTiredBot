const singleRevivePhrases = [
  '{p1} gained new life and vigor after emergency services administered an espresso enema.'
];

const killPhrases = [
  '{p1} served {p2} a steaming hot espresso, but it was too strong--sending them to an eternal nap.',
  '{p1} tripped {p2} with a giant lasagna, causing a permanent pasta coma.',
  '{p1} launched a Vespa at {p2}, riding them straight into the afterlife.',
  '{p1} trapped {p2} in a fog of chronic fatigue, leaving them too tired to fight back.',
  '{p1} overwhelmed {p2} with a wave of joint pain, causing them to collapse permanently.',
  '{p1} gave {p2} a taste of their dizziness spell, sending them spinning into the abyss.',
  '{p1} rolled {p2} into a giant joint and smoked them into oblivion.',
  '{p1} hit {p2} with such a strong bong rip that they vanished in a cloud of smoke.',
  '{p1} offered {p2} a space brownie, which sent them on a one-way trip to nowhere.',
  '{p1} hit {p2} with a flying wine bottle, smashing their hopes and dreams.',
  '{p1} set {p2} ablaze with a fiery vengeance, leaving nothing but ashes. (Fire Gang)',
  '{p1} painted the town red, blue, and yellow by taking down {p2} in a burst of rainbow chaos. (Rainbow Gang)',
  '{p1} unleashed toxic fumes, suffocating {p2} in a cloud of deadly mist. (Toxic Gang)',
  '{p1} electrified {p2} with a shocking jolt, leaving them twitching on the ground. (Electro Gang)',
  '{p1} slicked {p2} into submission with an overdose of pomade, leaving them glossy and defeated. (Pomade Paradise Gang)',
  '{p1} wielded their Viking Beard like a battle axe, taking down {p2} with a mighty swing.',
  '{p1} unleashed a swarm from their Bees Beard, swarming {p2} into submission.',
  '{p1} bluffed {p2} into oblivion at the poker table, leaving no chips behind. (Poker Buddy)',
  '{p1} dealt a deadly hand to {p2}, proving that Poker Buddies aren\'t always friendly.',
  '{p1} put {p2} to sleep permanently with a Too Much Snooze overdose.',
  '{p1} knocked {p2} into orbit with their Astronaut Hat, sending them to the stars.',
  '{p1} smothered {p2} with their Pillow Hat, leaving them dreaming forever.',
  '{p1} flattened {p2} under the weight of their Nachoman Hat, leaving them cheesy and crushed.',
  '{p1} silenced {p2} with a mutant mouth bite, proving that a Mutant Mouth can be deadly.',
  '{p1}\'s Ginger Beard whipped {p2} into submission, leaving them red-faced and defeated.'
];

const deathPhrases = [
  '{p1} fell asleep counting sheep and never woke up.',
  '{p1} got lost in the labyrinth of ME/CFS symptoms and couldn\'t find their way back.',
  '{p1} overdid it with the espresso shots and their heart couldn\'t handle the caffeine overload.',
  '{p1} succumbed to an unrelenting fatigue, their energy finally drained.',
  '{p1} couldn\'t navigate through the brain fog and wandered off into the void.',
  '{p1} was defeated by a relentless headache that felt like a never-ending storm.',
  '{p1} got so stoned that they floated away into the cosmos.',
  '{p1} lost themselves in a haze of smoke, never to return.',
  '{p1} drank too much vino and passed out permanently.',
  '{p1} choked on a massive meatball and couldn\'t be saved.',
  '{p1} got burned playing with the Fire Gang\'s flames.',
  '{p1} drowned in a puddle of rainbow paint.',
  '{p1} couldn\'t escape the Toxic Gang\'s deadly fog.',
  '{p1} got zapped by a stray bolt from the Electro Gang.',
  '{p1} slipped in a pool of pomade and never got up.',
  '{p1} slipped on their Viking Beard and fell into Valhalla.',
  '{p1} lost their last poker chip and their life. (Poker Buddy)',
  '{p1} got bluffed by a Poker Buddy and folded out of existence.',
  '{p1} snoozed too much and never woke up.',
  '{p1} suffocated under their own Pillow Hat.',
  '{p1} got buried under a pile of nachos from their Nachoman Hat.',
  '{p1} couldn\'t handle the bite of their own Mutant Mouth.',
  '{p1} got tangled in their Ginger Beard and couldn\'t escape.',
  '{p1} stared too long at their Battery Low Pupils and powered down for good.',
  '{p1} tried to pace in the Snooze Brew BG, misjudged the energy envelope, and crashed permanently.'
];

const revivePhrases = [
  '{p1} was revived by the aroma of a freshly brewed Italian coffee.',
  '{p1} woke up feeling refreshed after hearing a classic Italian opera.',
  '{p1} found clarity through the brain fog, coming back stronger than ever.',
  '{p1} was re-energized by a burst of vitality, shaking off the chronic fatigue.',
  '{p1} woke up from a stoner\'s nap, feeling surprisingly refreshed.',
  '{p1} was revived with a shot of the strongest espresso.',
  '{p1} rose from the ashes, Phoenix-style, ready to fight another day. (Fire Gang)',
  '{p1} found a rainbow after the storm, bringing them back to life. (Rainbow Gang)',
  '{p1} detoxified and came back fresher than ever. (Toxic Gang)',
  '{p1} got a jolt of energy, recharging their life force. (Electro Gang)',
  '{p1} slicked back into action with a fresh coat of pomade. (Pomade Paradise Gang)',
  '{p1} buzzed back into action, Bees Beard fully recharged.',
  '{p1} shuffled the deck and re-entered the game, poker face intact. (Poker Buddy)',
  '{p1} got a second chance with a new poker hand.',
  '{p1} fluffed their Pillow Hat and woke up refreshed.',
  '{p1} mutated back to life with a new bite.',
  '{p1} blinked through their Very Tired Lids, somehow still in the fight.',
  '{p1} reappeared from the Graveyard BG after an emergency pacing reset.'
];

const lifePhrases = [
  '{p1} is typing...',
  '{p1} started daydreaming about a vacation in Venice.',
  '{p1} discovered a new strategy to cope with the relentless brain fog.',
  '{p1} began documenting their symptoms in a journal to better understand their condition.',
  '{p1} began experimenting with edibles to ease their joint pain.',
  '{p1} spent the afternoon perfecting their rolling technique.',
  '{p1} started a quest to find the best pizza in town.',
  '{p1} started perfecting their fire-breathing skills. (Fire Gang)',
  '{p1} painted a mural in vibrant colors. (Rainbow Gang)',
  '{p1} brewed up a new batch of toxic potions. (Toxic Gang)',
  '{p1} spent the day experimenting with electrical circuits. (Electro Gang)',
  '{p1} polished their hair to a mirror shine. (Pomade Paradise Gang)',
  '{p1} sharpened their Viking Beard for the next battle.',
  '{p1} polished their poker skills, ready for the next hand. (Poker Buddy)',
  '{p1} started practicing their poker face for the next game.',
  '{p1} hit the snooze button one more time.',
  '{p1} adjusted their Astronaut Hat and prepared for takeoff.',
  '{p1} fluffed their Pillow Hat for maximum comfort.',
  '{p1} added extra cheese to their Nachoman Hat.',
  '{p1} sharpened their Mutant Mouth for the next bite.',
  '{p1} groomed their Ginger Beard to perfection.',
  '{p1} hid behind their Light Sensitivity Shades and called it strategy.',
  '{p1} checked their Coffee Pupils and decided one more espresso was medically necessary.',
  '{p1} stared into the Binary BG until the brain fog briefly sorted itself out.'
];

const items = [
  {
    name: '☕ Espresso Shot',
    tags: ['coffee', 'common'],
    unlockPhrases: ['{p1} found an Espresso Shot hidden behind the counter.'],
    killPhrases: [
      '{p1} slammed {p2} with an Espresso Shot so concentrated it triggered a permanent crash.',
      '{p1} handed {p2} an Espresso Shot with malicious optimism, and their nervous system tapped out.'
    ]
  },
  {
    name: '🛵 Mini Vespa',
    tags: ['vespa', 'rare', 'vehicle'],
    unlockPhrases: ['{p1} unlocked a Mini Vespa parked in the piazza.'],
    killPhrases: [
      '{p1} revved a Mini Vespa straight through {p2}\'s pacing plan, sending them into the afterlife.',
      '{p1} drifted a Mini Vespa around {p2} so violently that even their Shining Pupils went dark.',
      '{p1} launched their Mini Vespa off the Street BG curb and flattened {p2} in a legendary crash.'
    ]
  },
  {
    name: '💊 Pain Relief Meds',
    tags: ['medical', 'utility'],
    unlockPhrases: ['{p1} found Pain Relief Meds in the first aid kit.'],
    killPhrases: [
      '{p1} gave {p2} the wrong Pain Relief Meds dose, and the fight ended immediately.',
      '{p1} weaponized Pain Relief Meds against {p2}, who slipped into an irreversible nap.'
    ]
  },
  {
    name: '🕶️ Light Sensitivity Shades',
    tags: ['defense', 'sensory'],
    unlockPhrases: ['{p1} picked up a pair of Light Sensitivity Shades from the drawer.'],
    killPhrases: [
      '{p1} flashed Light Sensitivity Shades at {p2}, reflecting enough disco glare to finish them off.',
      '{p1} used Light Sensitivity Shades to blindside {p2}, who stumbled straight out of existence.'
    ]
  },
  {
    name: '🛏️ Restorative Bed',
    tags: ['rest', 'rare'],
    unlockPhrases: ['{p1} stumbled upon a Restorative Bed hidden in the attic.'],
    killPhrases: [
      '{p1} tucked {p2} into a Restorative Bed so deep they never returned.',
      '{p1} deployed a Restorative Bed beneath {p2}, and the nap became permanent.'
    ]
  },
  {
    name: '🌿 Magic Herb',
    tags: ['stoner', 'utility'],
    unlockPhrases: ['{p1} found some Magic Herb in a hidden stash.'],
    killPhrases: [
      '{p1} passed Magic Herb to {p2}, who floated beyond the Moon BG and never came back.',
      '{p1} hotboxed {p2} with Magic Herb until they vanished into the haze.'
    ]
  },
  {
    name: '🔥 Blazing Bong',
    tags: ['stoner', 'fire'],
    unlockPhrases: ['{p1} discovered a Blazing Bong in the attic.'],
    killPhrases: [
      '{p1} ripped the Blazing Bong so hard that {p2} was erased in a smoke cloud.',
      '{p1} cracked {p2} with a Blazing Bong and sent them directly to the Graveyard BG.'
    ]
  },
  {
    name: '🍪 Cosmic Cookie',
    tags: ['stoner', 'space'],
    unlockPhrases: ['{p1} baked a batch of Cosmic Cookies in the kitchen.'],
    killPhrases: [
      '{p1} fed {p2} a Cosmic Cookie potent enough to launch them out of the Rocket BG.',
      '{p1} lured {p2} into eating a Cosmic Cookie, and they never landed from the trip.'
    ]
  },
  {
    name: '🍷 Divine Wine',
    tags: ['pub', 'chaos'],
    unlockPhrases: ['{p1} found a bottle of Divine Wine hidden away.'],
    killPhrases: [
      '{p1} smashed Divine Wine over {p2}, turning the Pub BG into a funeral.',
      '{p1} poured Divine Wine for {p2}, and their last toast was also their last breath.'
    ]
  },
  {
    name: '☕ Super Espresso',
    tags: ['coffee', 'rare'],
    unlockPhrases: ['{p1} brewed a cup of Super Espresso for a quick boost.'],
    killPhrases: [
      '{p1} blasted {p2} with Super Espresso so intense their Battery Low Pupils flatlined.',
      '{p1} handed {p2} a Super Espresso and watched them vibrate into oblivion.'
    ]
  },
  {
    name: '🔥 Fire Bomb',
    tags: ['fire-gang', 'explosive'],
    unlockPhrases: ['{p1} found a Fire Bomb in the gang hideout. (Fire Gang)'],
    killPhrases: [
      '{p1} lobbed a Fire Bomb at {p2}, leaving only scorched ashes and Fire King Pupils.',
      '{p1} set off a Fire Bomb under {p2}, and the Fire Gang collected another victim.'
    ]
  },
  {
    name: '🌈 Rainbow Paintball Gun',
    tags: ['rainbow-gang', 'ranged'],
    unlockPhrases: ['{p1} discovered a Rainbow Paintball Gun in the stash. (Rainbow Gang)'],
    killPhrases: [
      '{p1} splattered {p2} with a Rainbow Paintball Gun until the colors turned fatal.',
      '{p1} painted {p2} out of the bracket with a Rainbow Paintball Gun. (Rainbow Gang)'
    ]
  },
  {
    name: '☠️ Toxic Gas Canister',
    tags: ['toxic-gang', 'cloud'],
    unlockPhrases: ['{p1} stumbled upon a Toxic Gas Canister in the lab. (Toxic Gang)'],
    killPhrases: [
      '{p1} cracked open a Toxic Gas Canister near {p2}, and the fog did the rest.',
      '{p1} rolled a Toxic Gas Canister at {p2}, who coughed themselves out of the fight.'
    ]
  },
  {
    name: '⚡ Electro Taser',
    tags: ['electro-gang', 'shock'],
    unlockPhrases: ['{p1} picked up an Electro Taser off a defeated rival. (Electro Gang)'],
    killPhrases: [
      '{p1} hit {p2} with an Electro Taser and hard-reset their life bar.',
      '{p1} zapped {p2} with an Electro Taser until their Robot Pupils went dark.'
    ]
  },
  {
    name: '✨ Pomade Grenade',
    tags: ['pomade-gang', 'slick'],
    unlockPhrases: ['{p1} uncovered a Pomade Grenade in the salon. (Pomade Paradise Gang)'],
    killPhrases: [
      '{p1} rolled a Pomade Grenade at {p2}, who slipped straight into oblivion.',
      '{p1} slicked the arena with a Pomade Grenade and {p2} never got back up.'
    ]
  },
  {
    name: '🪮 Viking Beard Comb',
    tags: ['beard', 'melee'],
    unlockPhrases: ['{p1} found a Viking Beard Comb lodged in the beard room, still humming with battle energy.'],
    killPhrases: [
      '{p1} sharpened a Viking Beard Comb and carved {p2} right out of the fight.',
      '{p1} dragged the Viking Beard Comb through {p2}\'s defenses like a Norse finishing move.'
    ]
  },
  {
    name: '🐝 Bee Keeper\'s Hat',
    tags: ['bees', 'swarm'],
    unlockPhrases: ['{p1} uncovered a Bee Keeper\'s Hat beside the Bee Body rack and heard a dangerous buzzing.'],
    killPhrases: [
      '{p1} unleashed a Bee Keeper\'s Hat swarm on {p2}, who disappeared under pure buzzing chaos.',
      '{p1} slapped on a Bee Keeper\'s Hat and sicced an angry cloud of bees on {p2}.'
    ]
  },
  {
    name: '♠️ Lucky Poker Chip',
    tags: ['poker', 'luck'],
    unlockPhrases: ['{p1} found a Lucky Poker Chip under the felt table in the Poker Buddy corner.'],
    killPhrases: [
      '{p1} flicked a Lucky Poker Chip at {p2}, and the house collected them permanently.',
      '{p1} went all-in with a Lucky Poker Chip and {p2} folded out of existence.'
    ]
  },
  {
    name: '🃏 Poker Buddy Card',
    tags: ['poker', 'trick'],
    unlockPhrases: ['{p1} drew a Poker Buddy Card from a suspicious deck and started smiling for no good reason.'],
    killPhrases: [
      '{p1} revealed a Poker Buddy Card and bluffed {p2} into the afterlife.',
      '{p1} played a Poker Buddy Card on {p2}, whose hand and life both collapsed.'
    ]
  },
  {
    name: '💤 Too Much Snooze Pill',
    tags: ['sleep', 'rare'],
    unlockPhrases: ['{p1} found a Too Much Snooze Pill rattling around in the Snooze Brew BG medicine cabinet.'],
    killPhrases: [
      '{p1} slipped {p2} a Too Much Snooze Pill, and the nap lasted forever.',
      '{p1} launched a Too Much Snooze Pill at {p2}, who passed out permanently on impact.'
    ]
  },
  {
    name: '🚀 Astronaut Helmet',
    tags: ['space', 'gear'],
    unlockPhrases: ['{p1} recovered an Astronaut Helmet from the Rocket BG storage locker.'],
    killPhrases: [
      '{p1} sealed {p2} inside an Astronaut Helmet and watched them drift into nothingness.',
      '{p1} rammed an Astronaut Helmet into {p2}, launching them off the map.'
    ]
  },
  {
    name: '🧀 Nachoman Hat',
    tags: ['food', 'hat'],
    unlockPhrases: ['{p1} grabbed a Nachoman Hat from the snack shrine, already dripping with dangerous cheese.'],
    killPhrases: [
      '{p1} crushed {p2} beneath a Nachoman Hat avalanche of molten cheese.',
      '{p1} hurled a Nachoman Hat at {p2}, smothering them in irreversible nacho doom.'
    ]
  },
  {
    name: '🦷 Mutant Mouth Guard',
    tags: ['mutant', 'bite'],
    unlockPhrases: ['{p1} strapped on a Mutant Mouth Guard found near the Special Mouth display.'],
    killPhrases: [
      '{p1} bit through {p2} with a Mutant Mouth Guard and ended the round in one chomp.',
      '{p1} snapped a Mutant Mouth Guard onto their face and chewed {p2} out of reality.'
    ]
  },
  {
    name: '🧔 Ginger Beard Brush',
    tags: ['beard', 'ginger'],
    unlockPhrases: ['{p1} found a Ginger Beard Brush in the grooming drawer, glowing with beard violence.'],
    killPhrases: [
      '{p1} whipped {p2} with a Ginger Beard Brush until they dropped permanently.',
      '{p1} brushed their Ginger Beard to peak power, then swept {p2} into the void.'
    ]
  }
];

const massKillEvents = [
  {
    name: 'Brain Fog Front',
    phrase: 'A giant brain fog front rolls through the arena, and {players} lose track of reality long enough to be eliminated.'
  },
  {
    name: 'Snooze Brew Facility Collapse',
    phrase: 'The Snooze Brew facility collapses under a pile of overused pillows, burying {players} in catastrophic sleep debt.'
  },
  {
    name: 'Mass Fatigue Crash',
    phrase: 'A brutal PEM wave hits the lobby at once, and {players} crash too hard to continue.'
  },
  {
    name: 'Toxic Cloud Leak',
    phrase: 'A Toxic Gang leak fills the channel with deadly fumes, taking {players} out in one coughing fit.'
  },
  {
    name: 'Rainbow Paint Disaster',
    phrase: 'A Rainbow Gang paint cannon misfires and sweeps {players} off the board in technicolor chaos.'
  },
  {
    name: 'Overcaffeination Catastrophe',
    phrase: 'The espresso machine goes feral, and {players} are blasted into irreversible caffeine oblivion.'
  }
];

const massReviveEvents = [
  {
    name: 'Emergency Espresso Distribution',
    phrase: 'Emergency responders flood the arena with restorative espresso, and {players} jolt back into the fight.'
  },
  {
    name: 'Miracle Nap Reset',
    phrase: 'A miracle nap reset settles over the graveyard, and {players} wake up confused but alive.'
  },
  {
    name: 'Electro Recharge Burst',
    phrase: 'An Electro Gang surge crackles through the dead zone, rebooting {players} back into action.'
  },
  {
    name: 'Aura Pulse',
    phrase: 'A mysterious aura pulse from the collection revives {players} in a blaze of impossible energy.'
  },
  {
    name: 'Snooze Brew Graveyard Leak',
    phrase: 'A leak from the Snooze Brew BG reaches the graveyard, and {players} stumble back out smelling like coffee and bad choices.'
  }
];

module.exports = {
  singleRevivePhrases,
  killPhrases,
  deathPhrases,
  revivePhrases,
  lifePhrases,
  items,
  massKillEvents,
  massReviveEvents
};
