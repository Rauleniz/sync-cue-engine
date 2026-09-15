# Sync Cue Engine

> Motor de sincronización de eventos visuales por Timecode — el mismo problema técnico que hay detrás de un show de drones, pirodrones o mapping, resuelto en el navegador.

> A visual event synchronization engine driven by Timecode — the same core technical problem behind drone light shows, pyrotechnic drone displays, and projection mapping, solved right in the browser.

---

## Español

### ¿Qué resuelve?

En un show de drones o de mapping, cientos de actores (drones, cañones de luz, baterías de pirotecnia) deben disparar eventos en el **milisegundo exacto** marcado en una hoja de cues. Si usas `setInterval` o `setTimeout` de JavaScript para temporizar esos disparos, el drift acumulado en pocos segundos hace que la sincronización con el audio se rompa de forma visible.

**Sync Cue Engine** demuestra la solución correcta: usar el reloj de alta precisión de la **Web Audio API** a través de `Tone.Transport`. El error de sincronización medido en la demo es prácticamente 0 ms frente al audio de referencia.

### Características MVP

- Cargar y reproducir una pista de audio local (mp3 / wav)
- Editor de hoja de cues: lista de timestamps (`mm:ss:ms`) con evento asociado (color, texto, posición 2D)
- Reproducción sincronizada con `Tone.Transport` — sin `setInterval`, sin drift
- Vista "escenario": zona visual donde los cues se disparan en tiempo real como cambios de color / posición (simula un enjambre de drones o una fachada de mapping)
- Medición de desviación en pantalla: muestra el error de sincronización en ms en cada cue disparado

### Stack

- HTML / JavaScript (sin framework)
- [Tone.js](https://tonejs.github.io/) — reloj de audio de alta precisión
- 100 % cliente — sin backend, desplegado en GitHub Pages

### Demo en vivo

[https://raulizquierdoportatil.github.io/sync-cue-engine/](https://raulizquierdoportatil.github.io/sync-cue-engine/)

### Uso rápido

1. Abre la demo en el navegador
2. Carga un archivo de audio (mp3 o wav)
3. Añade cues en la hoja de cues con el formato `mm:ss:ms`
4. Pulsa **Play** y observa los eventos dispararse en el escenario sincronizados con el audio
5. Revisa la columna "Desviación" para verificar la precisión

### Extensión futura (no en roadmap activo)

Decodificación de señal **LTC/SMPTE** real desde una pista de audio embebida — la versión "de verdad" del timecode que se usa en producción profesional.

---

## English

### What does it solve?

In a drone light show or projection mapping performance, hundreds of actors (drones, lights, pyrotechnic units) must fire their events at the **exact millisecond** written in a cue sheet. Using JavaScript's `setInterval` or `setTimeout` for this timing causes cumulative drift that visibly breaks synchronization with the audio track within seconds.

**Sync Cue Engine** demonstrates the correct solution: using the high-precision clock of the **Web Audio API** via `Tone.Transport`. The synchronization error measured in the demo is effectively 0 ms against the reference audio.

### MVP Features

- Load and play a local audio track (mp3 / wav)
- Cue sheet editor: list of timestamps (`mm:ss:ms`) with an associated event (color, text, 2D position)
- Synchronized playback with `Tone.Transport` — no `setInterval`, no drift
- "Stage" view: visual area where cues fire in real time as color/position changes (simulates a drone swarm or a mapping facade)
- On-screen deviation meter: displays the sync error in ms for each fired cue

### Stack

- HTML / JavaScript (no framework)
- [Tone.js](https://tonejs.github.io/) — high-precision audio clock
- 100 % client-side — no backend, hosted on GitHub Pages

### Live Demo

[https://raulizquierdoportatil.github.io/sync-cue-engine/](https://raulizquierdoportatil.github.io/sync-cue-engine/)

### Quick Start

1. Open the demo in your browser
2. Load an audio file (mp3 or wav)
3. Add cues to the cue sheet using the `mm:ss:ms` format
4. Press **Play** and watch events fire on the stage in sync with the audio
5. Check the "Deviation" column to verify timing precision

### Future Extension (not on active roadmap)

Decoding a real **LTC/SMPTE** signal from an embedded audio track — the "real" version of the timecode used in professional production.

---

## Licencia / License

MIT
