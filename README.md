# QuickSpace Soporte (Windows agent)

Remote support client used by QuickSpace technicians to assist their customers. The customer runs this portable app, reads a session code to the technician, and **explicitly accepts** each connection. Screen and input travel peer-to-peer over encrypted WebRTC.

*Aplicación de soporte remoto de QuickSpace para Windows. El cliente la abre, dicta un código al técnico y acepta cada conexión de forma explícita.*

## Download

Latest version: **[QuickSpace-Soporte.exe](https://github.com/quickspace-lat/quickspace-soporte/releases/latest/download/QuickSpace-Soporte.exe)** (Windows 10/11, portable, no installation). All releases: [Releases](https://github.com/quickspace-lat/quickspace-soporte/releases).

This program uses free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

*Descarga la última versión desde el enlace de arriba. No requiere instalación.*

## How it works

- Shows a 9-digit session code obtained from the QuickSpace signaling server (`config.json`).
- A technician can only connect after the customer clicks **Permitir** (Allow). During a session, an always-visible bar shows who is connected and a **Finalizar** (End) button.
- The technician may request a privacy screen; it is only enabled if the customer accepts, and the customer can end the session at any time.
- The app does not run in the background, does not start with Windows and does not install services. Closing the window ends all access.

## Build

```bash
npm ci
npm run dist          # dist/QuickSpace-Soporte.exe (portable)
```

Releases are built and signed by GitHub Actions (`.github/workflows/build.yml`) when a `v*` tag is pushed.

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

- Committers and reviewers: [Members of this repository](../../graphs/contributors)
- Approvers: repository owner

Only binaries built by the GitHub Actions workflow of this repository from its public source code are signed. Every signing request is manually approved.

## Privacy

This program connects to the QuickSpace signaling server configured in `config.json` when it starts, in order to obtain a session code. It sends the computer name and operating system so the technician can identify the device. Screen images and input are transmitted only during a session the user has explicitly accepted, directly to the technician's browser, and are not recorded. See the full privacy policy: https://remoto.quickspace.lat/privacidad.html

## License

Source code: [GNU AGPL v3.0](LICENSE). The QuickSpace name and logos are not licensed; see [TRADEMARKS.md](TRADEMARKS.md).
