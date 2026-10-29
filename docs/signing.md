# Signing Guide

This document describes how to sign the Phlix Tizen client for deployment to
Samsung Tizen TV devices. The external facts here were re-verified on
2026-10-29 against the linked official pages — Samsung moved the tooling
distribution and the certificate ceremony, and older docs (including this
file's previous edition) carried fabricated download URLs and CLI flags.

## Why Signing Is Required

Samsung Tizen TVs only accept applications that have been cryptographically
signed with a valid Tizen certificate. The signature proves the app was built
by an authorized developer and has not been tampered with after building.
Without a valid signature the `.wgt` package cannot be installed on a TV —
even a TV in Developer Mode rejects it ("invalid certificate").

---

## What You Need (2026)

| Piece | Purpose |
|---|---|
| **Tizen Studio** (6.1 era) or the newer **Tizen SDK 10 + VS Code Tizen extension** | Build environment, Certificate Manager, Device Manager, `tizen`/`sdb` CLI |
| **Samsung Certificate Extension ≥ 2.0.73** (via Package Manager) | Required to create TV certificates at all — older versions stopped working in September 2025 |
| **Samsung Developer account** | Author certificates are issued against it |
| **Certificate profile** (author + distributor certificates) | What `tizen package -s` selects by NAME when signing |
| **TV in Developer Mode** | Sideloading on your own TV without store approval |

> **Note**: the legacy `developer.tizen.org` portal has migrated — those URLs
> now redirect to [samsungtizenos.com](https://samsungtizenos.com). The tooling
> downloads page is <https://samsungtizenos.com/tools-download/>.

---

## Installing Tizen Studio

Official walk-through:
<https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html>

Installers are served directly from Samsung's download server — open the index
and pick the newest version folder (6.1 verified):
<https://download.tizen.org/sdk/Installer/tizen-studio_6.1/>. Each folder
offers:

- **GUI** (Studio + Certificate Manager + Package Manager):
  `web-ide_Tizen_Studio_6.1_windows-64.exe` / `_ubuntu-64.bin` / `_macos-64.dmg`
- **CLI-only** (headless/CI, no IDE):
  `web-cli_Tizen_Studio_6.1_windows-64.exe` / `_ubuntu-64.bin` / `_macos-64.bin`

Install the Ubuntu CLI build (curl-verified 200):

```bash
curl -LO https://download.tizen.org/sdk/Installer/tizen-studio_6.1/web-cli_Tizen_Studio_6.1_ubuntu-64.bin
```

After installing, open **Package Manager** (launcher:
`<install>/package-manager/package-manager(.exe)`, or via Tizen Studio) and on
the **Extension SDK** tab install:

1. the latest **TV Extensions-NN.NN** package, and
2. **Samsung Certificate Extension** (must be **2.0.73 or newer** — with an
   older version certificate creation silently fails; the direct package is at
   <https://download.tizen.org/sdk/extensions/tizen-certificate-extension_2.0.73.zip>).

---

## Creating the Certificate Profile (Certificate Manager)

Official walk-through:
<https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html>

1. Tizen Studio → **Tools → Certificate Manager** (dismiss the "Migration for
   Certificate Profile" prompt if it appears) → click **+**.
2. Click **Samsung** (not plain Tizen) → select **TV** → Next.
3. **Name the profile** — this name is exactly what `tizen package -s <name>`
   uses later. The profile binds an author and a distributor certificate.
4. **Author certificate**: "Create a new author certificate" (fill the form,
   sign in with your Samsung Developer account, choose a password and a backup
   location for `author.p12`) — or "Select an existing author certificate" and
   import a previously created `author.p12` with its password.
5. **Distributor certificate**: create one and pick a **privilege level**:
   - **development** — for sideloading your own TVs; you must register each
     target TV's **DUID** in the profile. Get a TV's DUID from Menu → Support →
     Contact Samsung (Unique Device ID) on the TV, or after `sdb connect`:
     `sdb capability | grep -i duid`.
   - **distribution** — store submission; no DUID list needed.
6. **Finish**. The profile is now selectable; the `.p12` files live wherever
   the wizard's backup/import path placed them (there is no fixed SDK-managed
   keystore path to hand-copy into — the earlier edition of this doc invented
   one).

Update law: a new version signed with a **different author certificate** is
treated as a *different app* — keep the same author certificate across updates.

---

## Building the Unsigned Widget

```bash
npm ci
npm run build      # vue-tsc --noEmit && vite build → dist/
node scripts/package.js   # assembles package/ (dist/* + app/config.xml + icon)
```

`package/` is the widget root (`config.xml` at its top). The `tizen` CLI signs
and packages it; the Tizen Studio GUI ("Build Signed Package") does the same.

### Signing via CLI (verified syntax)

CLI reference:
<https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html>

```bash
# The tizen CLI ships inside the Studio installation:
TIZEN=<install-dir>/tools/ide/bin/tizen        # `tizen.bat` on Windows

"$TIZEN" package -t wgt \
  -s <certificate-profile-name> \
  -o ./release \
  -- ./package
```

- `-s` takes the **profile NAME** created in Certificate Manager — not a
  `.p12` path. There is **no `--password` flag**; the key password is held by
  the profile. (If your profile was made on another machine, open Certificate
  Manager on this one and import it first. For non-Studio setups the CLI reads
  profiles from `tizen cli-config -g "default.profiles.path=<profiles.xml>"`.)
- The signed `.wgt` is written to the `-o` output directory.

### On-device signing (removed)

The previous edition of this doc showed a `sdb push` + `pkgcmd … -c <password>`
recipe. That flow does not exist on current Samsung TVs (the developer shell is
restricted); signing is a **host-side** operation. Delete any muscle memory of
it — the CLI block above is the way.

---

## Deploying to Your TV (Developer Mode Sideload)

Official TV-as-device walk-through:
<https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html>

1. **On the TV**: Smart Hub → **Apps** → open **App Settings** → type **12345**
   on the remote → the Developer Mode popup appears → toggle **Developer mode
   ON** → enter your **development computer's IP** → the TV asks for a **full
   power cycle** (on "Instant On" models the standby cycle is not enough —
   power off and back on). A "Develop Mode" banner should appear on boot.
2. **Connect**: the TV's sdb port is **26101** (not the legacy 26159 used by
   phone/wearable devices):
   ```bash
   sdb connect <TV_IP>:26101
   sdb devices    # target shows as <TV_IP>:26101
   ```
   (Or Tizen Studio → **Tools → Device Manager → Remote Device Manager → +**
   with IP `<TV_IP>`, port `26101`.)
3. **Permit installation**: on first install the TV shows a
   "Allow connection?" / **Permit to install applications** dialog — accept it
   (Device Manager also exposes it as a right-click action on the device).
4. **Install and launch**:
   ```bash
   "$TIZEN" install -n ./release/<signed>.wgt -t <TV_IP>:26101 -- ./package
   "$TIZEN" run -p phlix.app.phlixtizen -t <TV_IP>:26101
   ```
   `-t` is the **target name as shown by `sdb devices`**; `-p` is the
   **application id** from `app/config.xml`
   (`phlix.app.phlixtizen` — authoritative). The older `tizen launch` command
   in this doc's previous edition does not exist; it is `tizen run`.

---

## CI Signing (Status: Not Wired — By Design)

**What the shipped pipeline actually does** (`.github/workflows/build.yml`,
Linux `ubuntu-26.04` runners):

```bash
npm ci
npm run build && node scripts/package.js
# freshness gate asserts the committed package/ matches a fresh build
cd package && zip -r -X ../phlix-tizen-unsigned.wgt .
# artifact `phlix-tizen-wgt` uploaded; the "latest" GitHub release
# publishes this RAW, UNSIGNED .wgt
```

The published `.wgt` is **unsigned and not installable on a TV** — it exists
for inspection and as a convenience snapshot. Install requires signing with
your own certificate, which cannot happen in this repo's CI because the key is
yours, not the project's.

**Optional headless signing recipe** (your own runner; sketch, verify each
step against the linked CLI docs — the Studio installer is wizard-driven, so
either run it once interactively into a golden image or follow the installer's
unattended mode as documented by the current walk-through):

```yaml
# 1. Download web-cli installer:
#    https://download.tizen.org/sdk/Installer/tizen-studio_6.1/web-cli_Tizen_Studio_6.1_ubuntu-64.bin
# 2. Install TV Extensions + Samsung Certificate Extension ≥ 2.0.73 via the
#    bundled package-manager.
# 3. Decode secrets onto disk:
#    - TIZEN_AUTHOR_CERT   — base64 author.p12
#    - TIZEN_CERT_PROFILE  — base64 certificate-profile XML (from Certificate Manager)
#    - TIZEN_AUTHOR_CERT_PASSWORD
# 4. Point the CLI at the profile:
#    tools/ide/bin/tizen cli-config -g "default.profiles.path=$PWD/profiles.xml"
# 5. npm ci && npm run build && node scripts/package.js
# 6. tools/ide/bin/tizen package -t wgt -s <profile-name> -o ./release -- ./package
# 7. Upload/attach ./release/*.wgt (the SIGNED one) as the release asset.
```

Store submission (Samsung Apps) additionally needs a **distribution**-privilege
certificate and the Seller Portal flow — out of scope for self-host sideloading.

---

## Known Issues

- **"Invalid author certificate" / install refused**: the TV is not in
  Developer Mode, or your profile's **distributor certificate (development
  level) does not list that TV's DUID**, or "Permit to install applications"
  was never accepted.
- **Device won't connect**: use port **26101** for Samsung TVs. `26159` is the
  legacy phone/wearable port and fails against TVs.
- **Developer Mode popup never appears**: type **12345** from within **App
  Settings** on the Apps panel (not the home screen), and be on the TV and the
  dev machine on the same network.
- **Changes not visible after reboot**: "Instant On" models need a **full
  power cycle** for the Developer Mode IP to apply.
- **Certificate Manager won't create a TV certificate**: Samsung Certificate
  Extension is missing or older than **2.0.73** (see Installing above).
- **Update installs as a second app**: signed with a different author
  certificate than the installed version — keep one author certificate.
- **CI artifact won't install**: the `latest` release ships the **unsigned**
  `.wgt` on purpose; sign it yourself (CLI above) before installing.
