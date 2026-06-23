const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const pluginPath = path.resolve(__dirname, '..', 'bin', 'antigravity-cli-wakatime.js');
const hookConfigPath = path.resolve(__dirname, '..', 'hooks.json');
const runnerPath = path.resolve(__dirname, '..', 'scripts', 'run');

function platformName() {
  return process.platform === 'win32' ? 'windows' : process.platform;
}

function architecture() {
  if (process.arch === 'ia32' || process.arch.includes('32')) return '386';
  if (process.arch === 'x64') return 'amd64';
  return process.arch;
}

function createFixture(t, runtimeEnv = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'antigravity-cli-wakatime-'));
  const wakatimeDir = path.join(home, '.wakatime');
  const captureFile = path.join(home, 'calls.jsonl');
  const extension = process.platform === 'win32' ? '.exe' : '';
  const cliPath = path.join(wakatimeDir, `wakatime-cli-${platformName()}-${architecture()}${extension}`);

  fs.mkdirSync(wakatimeDir, { recursive: true });
  fs.writeFileSync(
    cliPath,
    `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv.includes('--version')) {
  process.stdout.write('<local-build>');
} else {
  fs.appendFileSync(process.env.WAKATIME_TEST_CAPTURE, JSON.stringify(process.argv.slice(2)) + '\\n');
}
`,
    { mode: 0o755 },
  );

  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const env = {
    ...process.env,
    WAKATIME_HOME: home,
    WAKATIME_TEST_CAPTURE: captureFile,
  };
  delete env.AGY_CLI_VERSION;
  delete env.ANTIGRAVITY_CLI_VERSION;
  delete env.ANTIGRAVITY_DESKTOP_VERSION;
  delete env.ANTIGRAVITY_IDE_VERSION;
  delete env.ANTIGRAVITY_VERSION;

  return {
    home,
    wakatimeDir,
    captureFile,
    env: { ...env, ...runtimeEnv },
  };
}

function readCalls(captureFile) {
  if (!fs.existsSync(captureFile)) return [];
  return fs
    .readFileSync(captureFile, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function waitForCall(captureFile) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const calls = readCalls(captureFile);
    if (calls.length) return calls;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return [];
}

test('hooks invoke the runner instead of node directly', () => {
  const hooks = fs.readFileSync(hookConfigPath, 'utf8');

  assert.doesNotMatch(hooks, /\bnode\b/);
  assert.match(hooks, /\.\/scripts\/run --event=preInvocation/);
  assert.match(hooks, /\.\/scripts\/run --event=postToolUse/);
});

test('runner uses NODE_BIN when node is unavailable in PATH', { skip: process.platform === 'win32' }, () => {
  const result = childProcess.spawnSync('/bin/sh', [runnerPath, '--event=postToolUse'], {
    env: {
      ...process.env,
      NODE_BIN: process.execPath,
      NODE_OPTIONS: '--definitely-not-a-valid-node-option',
      PATH: '',
    },
    input: '',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {});
});

test('syncs the first invocation with Antigravity CLI and project metadata', (t) => {
  const fixture = createFixture(t, { AGY_CLI_VERSION: '9.8.7' });
  const input = {
    invocationNum: 0,
    initialNumSteps: 1,
    workspacePaths: ['/workspace/project', '/workspace/secondary'],
    transcriptPath: '/home/user/.gemini/antigravity-cli/brain/session/.system_generated/logs/transcript.jsonl',
  };
  const result = childProcess.spawnSync(process.execPath, [pluginPath, '--event=preInvocation'], {
    env: fixture.env,
    input: JSON.stringify(input),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readCalls(fixture.captureFile), [
    ['--sync-ai-activity', '--plugin', 'antigravity-cli/9.8.7 antigravity-cli-wakatime/1.0.0', '--project-folder', '/workspace/project'],
  ]);
});

test('identifies Antigravity desktop from the hook payload', (t) => {
  const fixture = createFixture(t, { AGY_CLI_VERSION: '9.8.7' });
  const plistPath = path.join(fixture.home, 'Applications', 'Antigravity.app', 'Contents', 'Info.plist');
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(
    plistPath,
    '<plist><dict><key>CFBundleShortVersionString</key><string>2.1.4</string></dict></plist>',
  );
  const input = {
    invocationNum: 0,
    initialNumSteps: 1,
    workspacePaths: ['/workspace/project'],
    transcriptPath: '/home/user/.gemini/antigravity/brain/session/.system_generated/logs/transcript.jsonl',
  };
  const result = childProcess.spawnSync(process.execPath, [pluginPath, '--event=preInvocation'], {
    env: fixture.env,
    input: JSON.stringify(input),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readCalls(fixture.captureFile), [
    ['--sync-ai-activity', '--plugin', 'antigravity-desktop/2.1.4 antigravity-cli-wakatime/1.0.0', '--project-folder', '/workspace/project'],
  ]);
});

test('identifies Antigravity desktop from its global plugin install path', (t) => {
  const fixture = createFixture(t, { ANTIGRAVITY_DESKTOP_VERSION: '2.1.4' });
  const installedPluginPath = path.join(
    fixture.home,
    '.gemini',
    'config',
    'plugins',
    'antigravity-cli-wakatime',
    'bin',
    'antigravity-cli-wakatime.js',
  );
  fs.mkdirSync(path.dirname(installedPluginPath), { recursive: true });
  fs.copyFileSync(pluginPath, installedPluginPath);

  const result = childProcess.spawnSync(process.execPath, [installedPluginPath, '--event=postToolUse'], {
    env: fixture.env,
    input: JSON.stringify({ workspacePaths: ['/workspace/project'], stepIdx: 3 }),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readCalls(fixture.captureFile), [
    ['--sync-ai-activity', '--plugin', 'antigravity-desktop/2.1.4 antigravity-cli-wakatime/1.0.0', '--project-folder', '/workspace/project'],
  ]);
});

test('background hook returns valid JSON and leaves no payload or state files', async (t) => {
  const fixture = createFixture(t);
  const result = childProcess.spawnSync(process.execPath, [pluginPath, '--background', '--event=postToolUse'], {
    env: fixture.env,
    input: JSON.stringify({ workspacePaths: ['/workspace/project'], stepIdx: 3 }),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {});
  assert.equal((await waitForCall(fixture.captureFile)).length, 1);

  const unexpected = fs.readdirSync(fixture.wakatimeDir).filter((name) => /(?:hook|state|temp|tmp|backup|\.zip)/i.test(name));
  assert.deepEqual(unexpected, []);
});
