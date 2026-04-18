/*
  Super School Smash - Editable Data
  ==================================

  HOW TO ADD CUSTOM CHARACTERS
  ----------------------------
  1) Duplicate an existing character object in CHARACTERS.
  2) Set:
     - id, name, color, stats
     - sprite: image/gif URL (can be local path or web URL)
     - animations: idle/run/jump/fall/attack URLS (gif/png/webp)
  3) Edit attacks:
     - keys: neutral, up, down, side
     - each attack has damage, knockbackX, knockbackY, duration, cooldown
  4) Add attackAnimations URLs for each combo direction:
     attackAnimations.smash.neutral / up / down / side
     attackAnimations.special.neutral / up / down / side
  5) Left/right are mirrored automatically when direction is left.

  HOW TO ADD CUSTOM MAPS
  ----------------------
  1) Add a map object to MAPS with unique id/name.
  2) Set blastZone where players are KO'd.
  3) Set spawn points.
  4) Add platforms using x/y/w/h (pixels).
  5) Set background image URL (or empty for gradient fallback).
  6) Optional: set floorTexture/platformTexture image URLs.
*/

window.SSS_DATA = {
  settings: {
    width: 960,
    height: 540,
    gravity: 0.55,
    friction: 0.84,
    airFriction: 0.98,
    moveSpeed: 0.95,
    jumpPower: 11,
    maxJumps: 2,
    stocks: 3,
    maxPercent: 999
  },

  characters: [
    {
      id: "byte-brawler",
      name: "Byte Brawler",
      color: "#2ec4ff",
      stats: {
        weight: 1.0,
        speed: 1.0,
        jump: 1.0
      },
      sprite: "",
      animations: {
        idle: "",
        run: "",
        jump: "",
        fall: "",
        attack: ""
      },
      attackAnimations: {
        smash: {
          neutral: "",
          up: "",
          down: "",
          side: ""
        },
        special: {
          neutral: "",
          up: "",
          down: "",
          side: ""
        }
      },
      attacks: {
        smash: {
          neutral: { damage: 16, knockbackX: 7, knockbackY: -6, duration: 18, cooldown: 22 },
          up: { damage: 17, knockbackX: 2, knockbackY: -12, duration: 18, cooldown: 22 },
          down: { damage: 15, knockbackX: 1, knockbackY: 8, duration: 16, cooldown: 20 },
          side: { damage: 16, knockbackX: 9, knockbackY: -5, duration: 18, cooldown: 22 }
        },
        special: {
          neutral: { damage: 11, knockbackX: 5, knockbackY: -4, duration: 16, cooldown: 26 },
          up: { damage: 10, knockbackX: 1, knockbackY: -14, duration: 14, cooldown: 28 },
          down: { damage: 13, knockbackX: 0, knockbackY: 7, duration: 14, cooldown: 24 },
          side: { damage: 12, knockbackX: 8, knockbackY: -3, duration: 15, cooldown: 24 }
        }
      }
    }
  ],

  maps: [
    {
      id: "academy-arena",
      name: "Academy Arena",
      background: "",
      floorTexture: "",
      platformTexture: "",
      blastZone: { left: -200, right: 1160, top: -220, bottom: 760 },
      spawn: [
        { x: 320, y: 220 },
        { x: 640, y: 220 }
      ],
      floor: { x: 120, y: 420, w: 720, h: 26 },
      platforms: [
        { x: 260, y: 330, w: 160, h: 16 },
        { x: 540, y: 330, w: 160, h: 16 },
        { x: 430, y: 270, w: 100, h: 14 }
      ]
    }
  ]
};
