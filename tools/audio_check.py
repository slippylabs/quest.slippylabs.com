#!/usr/bin/env python3
"""The game's sound, in a headless browser: SlipKit's music and sfx players,
read back through window.soundEngine.kit (the kit's mixer, music and sfx).

    tools/audio_check.py [--url https://quest.slippylabs.com/]

Without --url it serves the repo itself (the save API 404s; guest play needs none).
  - the title plays its own theme once the page is touched (before a hero exists)
  - creating a hero takes you to Battleon Haven, which has its own song
  - a battle plays the region's song; the clock moves it on; every region is a
    different song (seed, key, tempo)
  - the fight reaches the intensity: low HP raises it, a boss takes it to full
  - attacks make sound, several plays of one sound are different takes, never one twice running
  - a win, a level up, a boss and a defeat play stingers (the win gives way to the level up)
  - the rules dialog muffles the music; M mutes everything (and flips the Sound button); no page errors
"""
import argparse, functools, http.server, os, sys, threading, time
sys.path.insert(0, "/home/slippy/projects/medievalmmo-dev/venv/lib/python3.13/site-packages")
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
fails = []


def check(cond, msg, detail=""):
    print(("ok    " if cond else "FAIL  ") + msg + (f" -- {detail}" if detail else ""), flush=True)
    if not cond:
        fails.append(msg)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def until(pg, js, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        if pg.evaluate(js):
            return True
        time.sleep(0.1)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    a = ap.parse_args()
    base = a.url
    if not base:
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_port}/index.html"
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        pg = b.new_context(viewport={"width": 1280, "height": 900}).new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        J = lambda js: pg.evaluate(js)
        pg.goto(base, wait_until="load")
        check(until(pg, "window.soundEngine && window.soundEngine.ready", 30), "the kit's modules load from the plain script")
        K = "soundEngine.kit"
        song = lambda: J(f"(() => {{ const s = {K}.music.song; return s && {{ seed: s.seed, key: s.tonic + ':' + s.mode + ':' + s.bpm, style: s.style }}; }})()")
        until(pg, "document.getElementById('guest-play-btn') && document.getElementById('guest-play-btn').offsetParent", 20)
        pg.mouse.click(5, 5)   # a real gesture: the AudioContext may start
        check(until(pg, f"{K}.mixer.ready && {K}.music.playing", 10), "a gesture unlocks the audio and starts the music")
        t = song()
        check(t and t["style"] == "adventure" and J("soundEngine.currentScene") == "title", "the title plays its RPG Adventure theme", str(t))
        # a hero: guest -> character creation -> town
        pg.click("#guest-play-btn")
        pg.fill("#hero-name-input", "Soundcheck")
        pg.click(".class-select-card[data-class='mage']")
        pg.click("#char-create-form button[type=submit], #char-create-form .primary-btn")
        check(until(pg, "window.gameEngine.player && soundEngine.currentScene === 'town'", 15), "creating a hero goes to town")
        time.sleep(0.3)
        town = song()
        check(town["seed"] != t["seed"], "Battleon Haven has its own song", str(town))
        # a battle in the Whispering Wilds
        J("switchTownTab('quests')")
        pg.click(".quest-card.unlocked .primary-btn")
        check(until(pg, "soundEngine.currentScene === 'battle'", 10), "entering a quest starts a battle")
        time.sleep(0.3)
        wild = song()
        check(wild["seed"] not in (t["seed"], town["seed"]), "the battle plays the region's song", str(wild))
        b0 = J(f"{K}.music.position().beat")
        time.sleep(1.5)
        b1 = J(f"{K}.music.position().beat")
        check(b1 > b0 + 1, "the audio clock moves the song on", f"{b0:.2f} -> {b1:.2f}")
        # intensity: full HP, low HP, a boss
        J("gameEngine.currentEnemy.isBoss = false; gameEngine.player.hp = gameEngine.player.maxHp; updateCombatUI()")
        hi_hp = J(f"{K}.music.intensity")
        J("gameEngine.player.hp = Math.max(1, Math.round(gameEngine.player.maxHp * 0.1)); updateCombatUI()")
        lo_hp = J(f"{K}.music.intensity")
        J("gameEngine.currentEnemy.isBoss = true; updateCombatUI()")
        boss = J(f"{K}.music.intensity")
        J("gameEngine.currentEnemy.isBoss = false; gameEngine.player.hp = gameEngine.player.maxHp; updateCombatUI()")
        check(0.4 <= hi_hp < 0.6 and lo_hp > hi_hp + 0.2 and boss >= 0.99, "the fight reaches the intensity (low HP up, boss full)", f"full {hi_hp:.2f}, low {lo_hp:.2f}, boss {boss:.2f}")
        # sounds: a real attack through the engine, then one sound several times
        before = J(f"{K}.sfx.played")
        J("executeBattleAction('attack')")
        until(pg, "gameEngine.isPlayerTurn || !gameEngine.inBattle", 15)
        after = J(f"{K}.sfx.played")
        played = {k: after.get(k, 0) - before.get(k, 0) for k in after if after.get(k, 0) != before.get(k, 0)}
        check(played.get("attack", 0) + played.get("crit", 0) >= 1, "an attack makes its sound through the kit", str(played))
        takes = J(f"""(async () => {{ const seen = [];
            for (let i = 0; i < 10; i++) {{ soundEngine.attack(); seen.push({K}.sfx.last.variant); await new Promise(r => setTimeout(r, 60)); }}
            return seen; }})()""")
        check(len(set(takes)) >= 3 and all(takes[i] != takes[i - 1] for i in range(1, len(takes))), "an attack is different takes, never one twice running", str(takes))
        spells = J(f"""(async () => {{ const seen = [];
            for (const e of ['fire', 'ice', 'lightning', 'light', 'darkness', 'arcane']) {{ soundEngine.spellCast(e); seen.push({K}.sfx.last.name); await new Promise(r => setTimeout(r, 40)); }}
            return seen; }})()""")
        check(len(set(spells)) == 6, "each element casts its own spell sound", str(spells))
        # every region its own song
        seeds, keys = set(), set()
        for z in ("wilds", "frostpeak", "magma", "crypts", "tempest", "void", "gauntlet"):
            J(f"soundEngine.scene('battle', '{z}')")
            time.sleep(0.1)
            s = song()
            seeds.add(s["seed"])
            keys.add(s["key"])
        check(len(seeds) == 7 and len(keys) == 7, "seven regions, seven different songs", str(sorted(keys)))
        J("soundEngine.scene('battle', gameEngine.currentZone.id)")
        # stingers
        st = J(f"""(async () => {{ const m = {K}.music, seen = []; const o = m.stinger;
            m.stinger = (k, x) => {{ seen.push(k); return o(k, x); }};
            soundEngine.victory(); await new Promise(r => setTimeout(r, 50));
            soundEngine.victory(); soundEngine.levelUp(); await new Promise(r => setTimeout(r, 50));
            soundEngine.encounter(true); await new Promise(r => setTimeout(r, 50));
            soundEngine.defeat();
            m.stinger = o; return seen; }})()""")
        check(st == ["win", "levelup", "boss", "lose"], "win, level up (instead of win), boss and defeat stingers", str(st))
        # rules dialog muffles
        J("openModal('rules-modal')")
        time.sleep(0.8)
        f = J(f"{K}.mixer.bus('muffle').frequency.value")
        check(f < 3000, "the rules dialog muffles the music", f"{f:.0f} Hz")
        J("closeAllModals()")
        time.sleep(0.8)
        f = J(f"{K}.mixer.bus('muffle').frequency.value")
        check(f > 15000, "closing it clears the muffle", f"{f:.0f} Hz")
        # M mutes, and the Sound button follows
        pg.keyboard.press("m")
        time.sleep(0.6)
        g = J(f"{K}.mixer.bus('master').gain.value")
        lab = J("document.getElementById('sound-btn').textContent")
        check(g < 0.02 and "OFF" in lab, "M mutes everything and the Sound button says so", f"master {g:.3f}, '{lab}'")
        pg.keyboard.press("m")
        time.sleep(0.6)
        g = J(f"{K}.mixer.bus('master').gain.value")
        check(g > 0.3 and "ON" in J("document.getElementById('sound-btn').textContent"), "M again unmutes", f"master {g:.3f}")
        # the Music button stops and restarts it
        pg.click("#music-btn")
        time.sleep(0.2)
        off = J(f"{K}.music.playing")
        pg.click("#music-btn")
        time.sleep(0.2)
        check(not off and J(f"{K}.music.playing"), "the Music button stops and restarts the music")
        J("localStorage.removeItem('aetherquest_music'); localStorage.removeItem('aetherquest_sound')")
        check(not errors, "no page errors", str(errors[:3]))
        b.close()
    if fails:
        print(f"\naudio_check: {len(fails)} FAILED")
        sys.exit(1)
    print("\naudio_check: all passed")


if __name__ == "__main__":
    main()
