# Media Organization Guide

This guide shows how to organize your existing sound files from `Saved sounds/` into the new `/server/media/` structure.

## Music Files (10 files)
Copy these to: `server/media/music/`

1. `christmas_music_box_music.wav` → `server/media/music/`
2. `christmas_piano_music.mp3` → `server/media/music/`
3. `echos-of-the-mead-hall_music.mp3` → `server/media/music/`
4. `horror-suspense_music.wav` → `server/media/music/`
5. `eerie_forest_backgroung-noice.mp3` → `server/media/music/`
6. `medieval-fantasy-rpg_music.flac` → `server/media/music/`
7. `medieval_village_atmosphere.wav` → `server/media/music/`
8. `pirate-tavern-croud.wav` → `server/media/music/`
9. `tavern-croud_music.wav` → `server/media/music/`
10. `slow_christmas_music.wav` → `server/media/music/`

## Ambience Files (1 file)
Copy these to: `server/media/ambience/`

1. `night_ambience.wav` → `server/media/ambience/`

## Sound Effects (96 files)
Copy these to: `server/media/sfx/`

### Alarms & Bells
- `alarm-clock.wav`
- `ding_shop-bell.wav`
- `elevator-chime.wav`
- `wind-chimes.wav`

### Animals
- `bird_whistling_chirping.wav`
- `cat-meow.wav`
- `cat-screech.wav`
- `large_dog_barking.wav`
- `small_dog_barking.wav`
- `chicken-bawking.wav`
- `cows-mooing.wav`
- `crow-call.wav`
- `owl-hoot.wav`
- `owl.wav`
- `rooster-calling-close.wav`

### Creatures & Monsters
- `dragon_growl.ogg`
- `monster-growl.flac`
- `monster_breath_growl.wav`
- `monster_zombie_growl.wav`
- `zombie_growl.wav`
- `wolf-growl.wav`
- `wolf-howl-moon.mp3`
- `wolf-howl.wav`

### Explosions & Impacts
- `big_explosion.wav`
- `glass-shatter.wav`
- `punch.wav`
- `punch_2.wav`
- `thud.wav`

### Fire & Heat
- `fireplace.wav`
- `fireworks_display.wav`

### Footsteps
- `footsteps_daytime_hike.wav`
- `footsteps_grass.wav`
- `footsteps_leaves.wav`
- `footsteps_sand.wav`
- `footsteps_snow.wav`
- `footsteps_water.wav`
- `footsteps_wood_stairs.wav`

### Horses
- `horse-whinny.wav`
- `horses_army_calvery_galloping.flac`
- `horse_galloping.wav`
- `trotting-horse-in-rural-road.mp3`

### Human Sounds
- `heavy-breathing.wav`
- `woman_scream.wav`
- `modern_crowd_cheering.wav`

### Magic & Spells
- `magic-heal.wav`
- `magic-missile.wav`
- `magic_fireball.wav`
- `poof.mp3`
- `magic-missiles.wav`
- `magic-spell.wav`

### Medical
- `heart-beep-monitor_dieing-long-beep.mp3`
- `heart_beat.mp3`

### Metalwork
- `anvil-being-struck.wav`
- `coin-clink_drop_gold_collect.wav`

### Nature & Weather
- `lightning_strike_loud.wav`
- `lightning_strike_soft.wav`
- `light_rain_shower.wav`
- `rain-on-windows-interior.wav`
- `stream-water.wav`
- `thunder_rumble.flac`
- `thunder_storm.mp3`
- `tree-falling-down.wav`

### Ships & Boats
- `pirate-ship-floating-noise.wav`
- `wood-ship-boat-floating-sounds.wav`

### Swords & Weapons
- `bow_shot.wav`
- `bullet-or-arrow-nearmiss.wav`
- `arrow_near-miss.wav`
- `sword-fall-on-dirt.wav`
- `sword-grinding-sharpening.wav`
- `sword-impact_flesh.wav`
- `sword-sharpen.m4a`
- `sword-sheath.wav`
- `sword-stab-body-hit.wav`
- `sword-swing.wav`
- `sword-unsheath.wav`
- `draw-sword.mp3`
- `large-sword-swing.wav`
- `sword-swing-connect-flesh.wav`
- `swords-fighting.wav`

### Technology & Devices
- `phone-ring.wav`
- `radio-static.mp3`
- `rewind.wav`
- `tick-tock.wav`

### Vehicles
- `car-engine-start.wav`
- `carcrash.wav`
- `train-passing-by.wav`
- `gun-shot.wav`
- `gunshot-distant.wav`

### Wind
- `whoosh.flac`
- `wind-whistling-through-window.mp3`
- `wind_howl.wav`
- `wind_windy.wav`

### Writing & Office
- `pencil_writing.wav`

### Horror & Creepy
- `ringing-in-the-ears.wav`
- `scratching-window.wav`

---

## PowerShell Commands to Copy Files

```powershell
# Navigate to the project root
cd "C:\Users\jenna\OneDrive\Desktop\Portfolio projects\CueAI"

# Copy all music files
Copy-Item "Saved sounds\christmas_music_box_music.wav" "server\media\music\"
Copy-Item "Saved sounds\christmas_piano_music.mp3" "server\media\music\"
Copy-Item "Saved sounds\echos-of-the-mead-hall_music.mp3" "server\media\music\"
Copy-Item "Saved sounds\horror-suspense_music.wav" "server\media\music\"
Copy-Item "Saved sounds\eerie_forest_backgroung-noice.mp3" "server\media\music\"
Copy-Item "Saved sounds\medieval-fantasy-rpg_music.flac" "server\media\music\"
Copy-Item "Saved sounds\medieval_village_atmosphere.wav" "server\media\music\"
Copy-Item "Saved sounds\pirate-tavern-croud.wav" "server\media\music\"
Copy-Item "Saved sounds\tavern-croud_music.wav" "server\media\music\"
Copy-Item "Saved sounds\slow_christmas_music.wav" "server\media\music\"

# Copy ambience file
Copy-Item "Saved sounds\night_ambience.wav" "server\media\ambience\"

# Copy all SFX files (you can run this as a batch or copy individually)
# This would be very long - see the categorized list above for all 96 files
```

## Alternative: Bulk Copy All SFX

```powershell
# Copy all WAV files to sfx folder
Get-ChildItem "Saved sounds\*.wav" | Where-Object { $_.Name -notmatch "music|ambience" } | Copy-Item -Destination "server\media\sfx\"

# Copy other formats
Copy-Item "Saved sounds\*.ogg" "server\media\sfx\"
Copy-Item "Saved sounds\*.flac" "server\media\sfx\" -ErrorAction SilentlyContinue
Copy-Item "Saved sounds\*.m4a" "server\media\sfx\" -ErrorAction SilentlyContinue
```

## Notes
- Total: 107 sound files (10 music, 1 ambience, 96 sfx)
- Most files are `.wav` format
- Some files use `.mp3`, `.flac`, `.ogg`, `.m4a` formats
- All files should maintain their original names
