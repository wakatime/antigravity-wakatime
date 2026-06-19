# Antigravity CLI WakaTime

[WakaTime][wakatime] plugin for [Antigravity CLI][antigravity-cli].

The plugin installs [wakatime-cli][wakatime-cli] into `~/.wakatime/`, checks GitHub Releases for wakatime-cli updates when a new Antigravity CLI session makes its first model invocation, and syncs AI heartbeats after model invocations and file-edit tool events.

The hook runner is detached and passes hook payloads over a pipe. It does not create update markers, heartbeat state, or temporary payload files.

## Install

```sh
agy plugin install https://github.com/wakatime/antigravity-cli-wakatime
```

Restart Antigravity CLI after installing the plugin.

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

[wakatime]: https://wakatime.com/
[antigravity-cli]: https://antigravity.google/docs/cli-overview
[wakatime-cli]: https://github.com/wakatime/wakatime-cli
