# Cabadi Skill VFX & Animation Guide

This guide describes how to animate and use the sprites for each skill level (Lv1-10).

## 1. Acorn Cannon (Speed Type)
- **Lv1-3**: Basic projectile motion. No rotation. Simple scale-in effect on spawn.
- **Lv4-6**: Add a subtle "spin" (360-degree rotation) to the acorn. Golden star particles should trail behind.
- **Lv7-9**: Intense fire tail. Use a "stretch" effect (squash/stretch) as it moves faster. Add an orange "heat" glow around the acorn.
- **Lv10**: Screen-shake on fire. 8 directional beams should fade in/out rapidly. Golden particle explosion on hit.

## 2. Poison Thorn (Piercing Type)
- **Lv1-3**: Linear movement. Purple drip particles intermittently.
- **Lv4-6**: V-shape and Fan-shape firing patterns. Thorns should rotate slightly toward their flight path.
- **Lv7-9**: Leaves a purple "poison cloud" (static sprite) at the impact point for 2 seconds.
- **Lv10**: Spiral motion (corkscrew). The thorn itself is surrounded by a swirling poison vortex.

## 3. Coconut Bomb (Explosive Type)
- **Lv1-3**: Arched trajectory (throw animation). Fuse sparks using tiny yellow particles.
- **Lv4-6**: "Pulsing" scaling animation before exploding (red glow increases).
- **Lv7-9**: 3-stage chain explosion. When one hits, it spawns two more at 45-degree angles.
- **Lv10**: Full-screen flash (white/orange). The mushroom cloud should scale up (0.5x to 2.0x) over 0.5s.

## 4. Mango Laser (Beam Type)
- **Lv1-3**: Raycast-based thin beam. Pulse opacity (0.7 to 1.0) for "energy" feel.
- **Lv4-6**: 2 parallel beams. Add "jitter" motion to the beams to show high power.
- **Lv7-9**: Rotating beam origin (satellite style). Rainbow gradient should shift (scroll UVs) over time.
- **Lv10**: 360-degree radial sweep. The center "Mango Core" should have a lens flare and severe screen shake.

... (Details for Homing Seed, Mud Shot, Tropical Thunder, Palm Drop follow similar patterns)
