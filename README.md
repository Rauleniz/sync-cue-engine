# Sync Cue Engine

> Motor de sincronización de audio por timecode — diseñado para la capa de audio y precisión de disparo en shows de drones, pirodrones y mapping.

> Audio timecode synchronization engine — built for the audio and cue-firing precision layer in drone shows, pyrotechnic displays, and projection mapping.

**[Demo en vivo / Live demo →](https://raulizquierdoportatil.github.io/sync-cue-engine/)**

---

## Español

### Qué resuelve

En un show de drones, pirodrones o mapping, los eventos deben dispararse en el **milisegundo exacto** marcado en la hoja de cues. Si usas `setInterval` o `setTimeout` de JavaScript para temporizar esos disparos, el drift acumulado rompe la sincronización con el audio en cuestión de segundos de forma audiblemente visible.

La solución correcta es usar el **reloj interno de la Web Audio API**, que opera sobre el mismo contexto de tiempo que el audio y no sufre ese drift. `Tone.Transport` expone ese reloj de forma manejable. Este proyecto demuestra que la desviación medida es prácticamente **0 ms** frente a la señal de referencia.

### Posicionamiento

Este motor resuelve la **capa de audio y sincronización** — transversal a cualquier disciplina visual. Quien lo integra decide qué se dispara: drones, proyección, pirotecnia. El autor no diseña la coreografía ni el mapping; entrega el motor de cues preciso sobre el que puede construirse cualquiera de esas disciplinas.

La parte visual de la demo existe únicamente como prueba de que los disparos llegan a tiempo. Su aspecto deliberadamente austero —un indicador que parpadea con el label y la desviación en ms— comunica que el foco es la ingeniería, no el espectáculo.

### Pista de audio

> **[PENDIENTE — completar cuando la pista esté mezclada]**
>
> La pista incluida en la demo fue compuesta y mezclada en Ableton Live. Nota de producción:
>
> - _Decisión 1: …_
> - _Decisión 2: …_
> - _Decisión 3: …_
>
> _(Esta sección describe las decisiones de diseño de sonido como haría una nota de producción — qué se buscó, por qué, con qué resultado.)_

### Cómo funciona

```
Audio file  ──►  Tone.Player  ──►  Web Audio output
                      │
                 Tone.Transport (Web Audio API internal clock)
                      │
              Cue scheduler (Transport.schedule)
                      │
              ┌───────┴────────┐
              │   At t = T     │  ← scheduled callback
              │  deviation =   │
              │  currentTime   │
              │  − scheduledT  │  ← measured in ms
              └───────┬────────┘
                      │
               Signal Monitor UI  ──►  label + deviation display
```

1. El audio y el transport arrancan desde el mismo origen de tiempo (`Tone.now() + 0.1 s`).
2. Cada cue se registra con `Tone.Transport.schedule(callback, timeSeconds)`.
3. Dentro del callback se captura `Tone.context.currentTime - scheduledTime` como desviación real.
4. Los callbacks de audio son asíncronos respecto al DOM; la cola `pendingCueEvents` traslada los disparos al `requestAnimationFrame` para actualizar la UI sin bloquear el hilo de audio.

### Stack

- HTML / JavaScript (sin framework)
- [Tone.js v14](https://tonejs.github.io/) — reloj de alta precisión sobre Web Audio API
- 100 % cliente — sin backend, desplegado en GitHub Pages

### Uso rápido

1. Abre la demo en el navegador
2. Carga una pista de audio (mp3 / wav)
3. Edita la hoja de cues: ajusta los timestamps y los labels de cada evento
4. Pulsa **Play** — el Signal Monitor muestra cada cue al dispararse con su desviación en ms
5. Verde `< 5 ms` / naranja `< 20 ms` / rojo `≥ 20 ms`

### Extensión futura (no en roadmap activo)

Decodificación de señal **LTC/SMPTE** real desde una pista de audio embebida — la versión "de verdad" del timecode que se usa en producción profesional. No está planificada para esta demo; se documenta aquí como dirección posible para quien quiera llevarla a producción.

---

## English

### What it solves

In a drone show, pyrotechnic display, or projection mapping performance, events must fire at the **exact millisecond** written in the cue sheet. Timing those fires with JavaScript's `setInterval` or `setTimeout` causes cumulative drift that audibly breaks synchronization with the audio track within seconds.

The correct solution is to use the **Web Audio API's internal clock**, which shares the same time context as the audio output and does not drift. `Tone.Transport` exposes that clock in a manageable way. This project demonstrates that the measured deviation is effectively **0 ms** against the reference signal.

### Positioning

This engine solves the **audio and synchronization layer** — common to any visual discipline. The integrator decides what gets triggered: drones, projection, pyrotechnics. The author does not design the choreography or the mapping; he delivers the precision cue engine on which any of those disciplines can be built.

The visual component of the demo exists only as proof that cues fire on time. Its deliberately austere appearance — an indicator that flashes with the label and deviation in ms — is intentional: the focus is engineering, not spectacle.

### Audio track

> **[PENDING — to be filled in once the track is mixed]**
>
> The track included in the demo was composed and mixed in Ableton Live. Production note:
>
> - _Decision 1: …_
> - _Decision 2: …_
> - _Decision 3: …_
>
> _(This section describes the sound design decisions as a production note would — what was aimed for, why, and with what result.)_

### How it works

```
Audio file  ──►  Tone.Player  ──►  Web Audio output
                      │
                 Tone.Transport (Web Audio API internal clock)
                      │
              Cue scheduler (Transport.schedule)
                      │
              ┌───────┴────────┐
              │   At t = T     │  ← scheduled callback
              │  deviation =   │
              │  currentTime   │
              │  − scheduledT  │  ← measured in ms
              └───────┬────────┘
                      │
               Signal Monitor UI  ──►  label + deviation display
```

1. Audio and transport share the same time origin (`Tone.now() + 0.1 s`).
2. Each cue is registered with `Tone.Transport.schedule(callback, timeSeconds)`.
3. Inside the callback, `Tone.context.currentTime - scheduledTime` is captured as the real deviation.
4. Audio callbacks are async relative to the DOM; a `pendingCueEvents` queue passes fires to `requestAnimationFrame` so the UI updates without blocking the audio thread.

### Stack

- HTML / JavaScript (no framework)
- [Tone.js v14](https://tonejs.github.io/) — high-precision clock over Web Audio API
- 100 % client-side — no backend, hosted on GitHub Pages

### Quick start

1. Open the demo in your browser
2. Load an audio file (mp3 / wav)
3. Edit the cue sheet: adjust the timestamps and label for each event
4. Press **Play** — the Signal Monitor shows each cue as it fires, with its deviation in ms
5. Green `< 5 ms` / orange `< 20 ms` / red `≥ 20 ms`

### Future extension (not on active roadmap)

Decoding a real **LTC/SMPTE** signal from an embedded audio track — the "real" version of the timecode used in professional production. Not planned for this demo; documented here as a possible direction for anyone wanting to take it to a production environment.

---

## Licencia / License

MIT
