# Build

```sh
# npm run gdefault
# npm run gzip
```

# Testing

- For dev env, just drag the `src` directory to the Chrome Manage Extensions
- every change in `src` directory, just click reload on the Chrome Manage Extensions

# Test in Firefox:

- Open Firefox, go to `about:debugging#/runtime/this-firefox`.
- Click “Load Temporary Add-on”, select `dist/avim-firefox-0.8.5.xpi` or `build/` or `manifest.json`.
- Test:
    + Open the popup and change settings (e.g., “Telex”, “Off”).
    + Type in a text input on an HTTP/HTTPS page (e.g., `https://example.com`) to verify AVIM.
    + Double-press Ctrl to toggle AVIM; check badge updates.
    + Test iframes with editable content (e.g., `contentEditable` elements or `designMode`).
    + Verify localization (placeholder in `inputDemo`).
- Check the Browser Console (Tools > Browser Console) for errors.
