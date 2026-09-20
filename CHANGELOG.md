# Changelog

## 0.1.2
- Server error pages are no longer shown as raw HTML in the panel.
- If the server doesn't support account linking, the panel says so and guest mode keeps working.

## 0.1.1
- Fixed `ClientConnectorCertificateError`: the plugin now verifies HTTPS against the system CA bundle
  (Decky's bundled Python could not find one). Verification stays on.
- Connection errors now name the real error type.

## 0.1.0
- First version: Quick Access panel, preset and typed questions, game-only screenshots via `gamescopectl`,
  Standard / Min-Max / Roleplay styles, full-screen answer reader, guest mode, QR-code account linking.
