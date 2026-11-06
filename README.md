# AetherQuest

> **ARCHIVED 2026-11-06.** Retired: nobody was playing it and no more work is planned. `quest.slippylabs.com` now 301s to the [Lab hub](https://lab.slippylabs.com), and the game is delisted from the hub, the home page and the GitHub profile. The save backend (`quest-dev` repo) is stopped too. The vhost that served it is in `~/archive/quest.slippylabs.conf.served-2026-11-06`. Its highscore entries and old leaderboard rows were kept. The notes below are history.

High-fantasy turn-based JRPG inspired by AdventureQuest. 5 classes, tactical elemental combat, dynamically scaled dungeons, and cloud progress saving.

**Live:** <https://quest.slippylabs.com/>

## What it is

- AetherQuest — a high-fantasy turn-based JRPG in the spirit of AdventureQuest.
- Five classes, tactical elemental combat, dungeons that scale to your level.
- Cloud progress saving, with Play-as-Guest for anyone who does not want an account.

## Running it locally

A static site — no build step:

```
git clone git@github.com:slippylabs/quest.slippylabs.com.git
cd quest.slippylabs.com
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Sound

Music and sound effects are SlipKit's (vendored in `js/vendor/slipkit/1.23.5/`, loaded from the plain
`js/audio.js` with a dynamic `import()`): a composed RPG Adventure song for the title, the town and each
quest region, intensity following the fight, stingers on a boss, a win, a level up and a defeat. M mutes.

## Tools / tests

- `tools/audio_check.py [--url https://quest.slippylabs.com/]` -- the music and sound, in headless Chromium
  (songs per place, intensity, varied takes, stingers, muffle, M, the music fading in to a quiet 0.3,
  the Music on/off button).

## Notes

Front end only — the backend is the separate **quest-dev** repo (`quest-backend.service`, port 8026).

This game has **its own account system**, separate from both the admin-console SSO and the Lab account. There is a `slippy_sso.py` in the backend repo that is not actually used by it.

---

Part of [Slippy Labs](https://slippylabs.com). Private repo — this README is internal documentation, not a public listing.
