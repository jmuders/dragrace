# Car Sprite Assets

Place PNG sprite files here to override the procedural pixel-art fallback:

| File               | Car             |
|--------------------|-----------------|
| `car_silver.png`   | Silver sedan    |
| `car_orange.png`   | Orange supercar |
| `car_red.png`      | Red coupe       |
| `car_green.png`    | Green supercar  |

## Requirements

- White (R≥248, G≥248, B≥248) pixels are automatically converted to transparent at runtime.
- Cars must face **right** (front on the right side of the image).
- Any resolution works; the game scales sprites to ~288 px wide in the race scene and ~190 px wide in the car selection screen.
