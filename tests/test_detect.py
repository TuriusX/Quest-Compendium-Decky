"""What's running beyond Steam's own games (main.py find_emulator_game and its parts), against a fake /proc: emulator
processes as EmuDeck, ES-DE, Flatpak and Proton start them, and RetroArch's content history. Also the backend's
emulator_game / learn_game ("Which game is this?" once per file)."""
import asyncio, json, os, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "fakes"))
sys.path.insert(0, os.path.join(HERE, ".."))
try:
    import aiohttp  # noqa: F401  (the backend imports it; nothing here uses it)
except ImportError:
    import types
    sys.modules["aiohttp"] = types.ModuleType("aiohttp")
if not hasattr(os, "getuid"):  # run on Windows: the Deck user's id doesn't matter here
    os.getuid = lambda: 1000
import main  # the real plugin backend

results = []
def check(name, cond, detail=""):
    results.append(cond)
    print(("PASS  " if cond else "FAIL  ") + name + (f"   -> {detail}" if (detail and not cond) else ""))


def fake_proc(procs):
    """procs: [(pid, exe_path or None, [args], started_offset_s)] -> a /proc-like folder."""
    root = tempfile.mkdtemp(prefix="qc-proc-")
    now = time.time()
    for pid, exe, args, ago in procs:
        d = os.path.join(root, str(pid))
        os.makedirs(d)
        with open(os.path.join(d, "cmdline"), "wb") as f:
            f.write(b"\0".join(a.encode() for a in args) + b"\0")
        if exe:
            try:
                os.symlink(exe, os.path.join(d, "exe"))
            except (OSError, NotImplementedError):
                pass  # no symlinks here (Windows without the right): the first argument still names the program
        os.utime(d, (now - ago, now - ago))
    return root


# ---- the parts ----
check("a file's name: regions, codes and versions gone", main.name_from_file("Super Metroid (Japan, USA) (En,Ja).sfc") == "Super Metroid")
check("a Switch file's name", main.name_from_file("Hollow Knight [0100633007D48000][v0].nsp") == "Hollow Knight")
check("codes and generic files don't name a game", main.name_from_file("SLUS-20946.iso") is None and main.name_from_file("game.iso") is None and main.name_from_file("0100F2C0115B6000.xci") is None)
check("a PS3 game's EBOOT.BIN: its folder", main.name_from_path("/run/media/mmcblk0p1/Emulation/roms/ps3/BLUS30443-[Demon's Souls]/PS3_GAME/USRDIR/EBOOT.BIN") == "Demon's Souls")
check("a ROM's folder isn't trusted (often just a collection)", main.name_from_path("/home/deck/Emulation/roms/psx/game.iso") is None)
check("RetroArch's core and config aren't the game", main.rom_from_args(["-L", "/home/deck/.config/retroarch/cores/snes9x_libretro.so", "--config", "/x/retroarch.cfg", "/roms/snes/Chrono Trigger (USA).sfc"]) == "/roms/snes/Chrono Trigger (USA).sfc")
check("versions aren't files", main.rom_from_args(["--title", "1.1.1376"]) is None)
check("an emulator from its program or an AppImage / Proton argument", main.emulator_of(["/usr/bin/dolphin-emu"]) == ("dolphin", "Dolphin")
      and main.emulator_of(["/tmp/.mount_x/usr/bin/AppRun", "/home/deck/Applications/Ryujinx.AppImage"])[0] == "ryujinx"
      and main.emulator_of(["Z:\\home\\deck\\Emulation\\tools\\xenia\\xenia_canary.exe"])[0] == "xenia"
      and main.emulator_of(["/usr/bin/bash"]) is None)
k = main.hash_key("dolphin|f:metroidprimeusarvz")
check("keys are hashed (no file names)", k.startswith("k") and len(k) == 25 and "metroid" not in k)

# ---- a running Deck ----
home = tempfile.mkdtemp(prefix="qc-home-")
proc = fake_proc([
    (100, "/usr/bin/bash", ["/bin/bash", "/home/deck/Emulation/tools/launchers/dolphin-emu.sh", "/roms/gc/Metroid Prime (USA).rvz"], 30),
    (101, "/app/bin/dolphin-emu", ["/app/bin/dolphin-emu", "-b", "-e", "/run/media/mmcblk0p1/Emulation/roms/gc/Metroid Prime (USA).rvz"], 29),
    (102, "/usr/lib/steam/steamwebhelper", ["steamwebhelper"], 500),
])
g = main.find_emulator_game(proc, home)
check("EmuDeck's Dolphin (Flatpak): the game from its file", g and g["emulator"] == "Dolphin" and g["name"] == "Metroid Prime", g)

proc2 = fake_proc([(200, "/usr/bin/retroarch", ["retroarch"], 20)])
check("RetroArch in its menus, nothing loaded: nothing", main.find_emulator_game(proc2, home) is None)
hist = os.path.join(home, ".config", "retroarch", "playlists", "builtin")
os.makedirs(hist)
with open(os.path.join(hist, "content_history.lpl"), "w") as f:
    json.dump({"version": "1.5", "items": [{"path": "/roms/psx/ff7.zip#Final Fantasy VII (USA) (Disc 1).cue", "label": "Final Fantasy VII (USA) (Disc 1)"}]}, f)
g = main.find_emulator_game(proc2, home)
check("RetroArch with a game picked from its menu: its content history", g and g["name"] == "Final Fantasy VII", g)

proc3 = fake_proc([(300, "/usr/bin/pcsx2-qt", ["/usr/bin/pcsx2-qt", "-fullscreen", "--", "/roms/ps2/game.iso"], 10)])
g3 = main.find_emulator_game(proc3, home)
check("a file with no name in it: found, name unknown (asked once)", g3 and g3["name"] is None and g3["key"].startswith("k"), g3)


async def backend():
    p = main.Plugin()
    await p._main()
    st = await p.get_state()
    check("automatic switching on by default", st["settings"]["auto_switch"] is True)
    await p.save_settings({"auto_switch": False})
    check("automatic switching can be turned off", (await p.get_state())["settings"]["auto_switch"] is False)
    real = main.find_emulator_game
    main.find_emulator_game = lambda root, h: main.__dict__["_t_found"]
    try:
        main.__dict__["_t_found"] = dict(g3)
        r = await p.emulator_game()
        check("no name yet: asked", r.get("ask") is True and r.get("name") is None, r)
        check("a made-up key isn't remembered", await p.learn_game("../settings", "x") is False)
        await p.learn_game(g3["key"], "Okami")
        r = await p.emulator_game()
        check("answered once: that file is that game from now on", r.get("name") == "Okami" and r.get("ask") is False, r)
        saved = json.load(open(main.SETTINGS_PATH))
        check("only the hashed key and the name are kept", saved["learned_games"] == {g3["key"]: "Okami"}, saved.get("learned_games"))
        await p.learn_game(g3["key"], "")
        r = await p.emulator_game()
        check("\"Not a game\" is remembered too", r.get("notGame") is True and not r.get("ask"), r)
        main.__dict__["_t_found"] = None
        check("nothing running: {}", await p.emulator_game() == {})
    finally:
        main.find_emulator_game = real


asyncio.run(backend())
print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
