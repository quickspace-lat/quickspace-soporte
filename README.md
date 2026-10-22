# Quick Space Soporte (Windows agent)

Remote support client used by Quick Space technicians to assist their customers. The customer runs this portable app, reads a session code to the technician, and **explicitly accepts** each connection. Screen and input travel peer-to-peer over encrypted WebRTC.

*Aplicación de soporte remoto de Quick Space para Windows. El cliente la abre, dicta un código al técnico y acepta cada conexión de forma explícita.*

## Download

**Recommended:** install from the Microsoft Store: **[Quick Space Soporte](https://apps.microsoft.com/detail/9NMGL93F8PNN)** (Windows 10/11).

Portable alternative (no installation, unsigned; some antivirus products may block it): [QuickSpace-Soporte.exe](https://github.com/quickspace-lat/quickspace-soporte/releases/latest/download/QuickSpace-Soporte.exe).

*Recomendado: instala la app desde la Microsoft Store con el enlace de arriba.*

## How it works

- Shows a 9-digit session code obtained from the Quick Space signaling server (`config.json`).
- A technician can only connect after the customer clicks **Permitir** (Allow). During a session, an always-visible bar shows who is connected and a **Finalizar** (End) button.
- The technician may request a privacy screen; it is only enabled if the customer accepts, and the customer can end the session at any time.
- The app does not run in the background, does not start with Windows and does not install services. Closing the window ends all access.

## Build

```bash
npm ci
npm run dist          # dist/QuickSpace-Soporte.exe (portable)
```

Releases are built and signed by GitHub Actions (`.github/workflows/build.yml`) when a `v*` tag is pushed.

## Privacy

This program connects to the Quick Space signaling server configured in `config.json` when it starts, in order to obtain a session code. It sends the computer name and operating system so the technician can identify the device. Screen images and input are transmitted only during a session the user has explicitly accepted, directly to the technician's browser, and are not recorded. See the full privacy policy: https://remoto.quickspace.lat/privacidad.html

## License

Source code: [GNU AGPL v3.0](LICENSE). The Quick Space name and logos are not licensed; see [TRADEMARKS.md](TRADEMARKS.md).
