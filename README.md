# Antigravity WakaTime

[WakaTime][wakatime] plugin for [Antigravity][antigravity] and [Antigravity CLI][antigravity-cli].

The plugin installs [wakatime-cli][wakatime-cli] into `~/.wakatime/`, checks GitHub Releases for wakatime-cli updates when a new session makes its first model invocation, and syncs AI heartbeats after model invocations and file-edit tool events. Hook payload and installation paths are used to identify whether the host is Antigravity or Antigravity CLI.

The hook runner is detached and passes hook payloads over a pipe. It does not create update markers, heartbeat state, or temporary payload files.

## Install for Antigravity CLI

```sh
agy plugin install https://github.com/wakatime/antigravity-cli-wakatime
```

Restart Antigravity CLI after installing the plugin.

## Install for Antigravity

Clone or copy this plugin directory into Antigravity's global plugin directory:

```sh
mkdir -p ~/.gemini/config/plugins
git clone https://github.com/wakatime/antigravity-cli-wakatime ~/.gemini/config/plugins/antigravity-cli-wakatime
```

Restart Antigravity after installing the plugin.

## Configuration

The plugin reads standard WakaTime settings from `~/.wakatime.cfg`.

Useful settings:

```ini
[settings]
api_key = XXXX
debug = true
proxy = https://user:pass@example.com:8080
```

Logs are written to `~/.wakatime/antigravity-cli.log`.

If Node.js is installed but is not available in the hook's `PATH`, set `NODE_BIN`
to the absolute path of the Node.js executable. On NixOS, the hook runner also
falls back to `nix run nixpkgs#nodejs` when `nix` is available.

[wakatime]: https://wakatime.com/
[antigravity]: https://antigravity.google/docs/plugins
[antigravity-cli]: https://antigravity.google/docs/cli-overview
[wakatime-cli]: https://github.com/wakatime/wakatime-cli
