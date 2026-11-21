const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const masterCode = "cohort-test-code";

async function startApp(t, config) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "choblog-cohort-test-"));
  let child;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill();
      await closed;
    }
    await fs.rm(dir, { recursive: true, force: true });
  });
  await fs.copyFile(path.join(root, "server.js"), path.join(dir, "server.js"));
  await fs.cp(path.join(root, "public"), path.join(dir, "public"), { recursive: true });
  if (config) await fs.writeFile(path.join(dir, "cohort11.json"), JSON.stringify(config));
  else await fs.copyFile(path.join(root, "cohort11.json"), path.join(dir, "cohort11.json"));

  child = spawn(process.execPath, [path.join(dir, "server.js")], {
    windowsHide: true,
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      DATA_DIR: path.join(dir, "data"),
      STATE_KEY: "choblog10",
      RENDER: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      MASTER_CODE: masterCode
    }
  });
  let output = "";
  const origin = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Test server exited with ${code}: ${output}`)));
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
  });
  return (route, { body, cookie, ...options } = {}) => fetch(`${origin}${route}`, {
    ...options,
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    signal: AbortSignal.timeout(5000)
  });
}

test("empty cohort 11 has its own branded pages, empty roster, and unscheduled weeks", { timeout: 15000 }, async (t) => {
  const app = await startApp(t, { roster: [], startDate: null });
  assert.equal((await app("/11", { redirect: "manual" })).headers.get("location"), "/11/");
  for (const page of ["", "links.html", "admin.html"]) {
    const html = await (await app(`/11/${page}`)).text();
    assert.match(html, /<title>초블11기/);
    assert.match(html, /data-base="\/11\/"/);
    assert.doesNotMatch(html, /\{\{(?:COHORT|BASE)\}\}/);
  }
  assert.match(await (await app("/")).text(), /<title>초블10기/);
  const data = await (await app(`/11/api/admin?code=${masterCode}`)).json();
  assert.deepEqual(data.roster, { all: [] });
  assert.deepEqual(data.groupSchedules, { all: [] });
  assert.deepEqual(data.audits, {});
  assert.equal((await app("/11/api/login", { body: { name: "테스트샘", phone: "01000000001" } })).status, 400);
});

test("cohort 11 restores a saved login and keeps submissions separate from cohort 10", { timeout: 15000 }, async (t) => {
  const name = "테스트샘";
  const app = await startApp(t, { roster: [name, "다른샘"], startDate: "2026-11-22" });
  const roster10 = await (await app("/api/roster")).json();
  const oldName = roster10.roster.senior[0];
  const login10 = await (await app("/api/login", { body: { name: oldName, group: "senior", phone: "01000000010" } })).json();
  const admin10 = `/api/admin?code=${masterCode}`;
  const previous = await (await app(admin10)).json();
  const login = await app("/11/api/login", { body: { name, phone: "01000000001" } });
  assert.equal(login.status, 200);
  const sessionHeader = login.headers.get("set-cookie");
  assert.match(sessionHeader, /Path=\/11\/; HttpOnly; SameSite=Lax; Max-Age=31536000/);
  const cookie = sessionHeader.split(";")[0];
  const { member } = await login.json();
  assert.equal(member.group, "all");
  assert.equal(member.sessionKey, undefined);
  assert.equal((await app(`/11/api/me?memberId=${member.id}`)).status, 401);
  assert.equal((await app(`/11/api/me?memberId=${login10.member.id}`)).status, 401);
  assert.equal((await (await app("/11/api/me", { cookie })).json()).member.name, name);

  const url = "https://example.com/blog/11";
  const body = { week: 1, mission: "mission1", url };
  assert.equal((await app("/11/api/submit", { body: { ...body, memberId: member.id } })).status, 401);
  assert.equal((await app("/11/api/submit", { cookie, body })).status, 200);
  assert.equal((await app("/11/api/submit", { cookie, body })).status, 409);
  const checklist = { stay: true, like: true, neighbor: true, secretComment: true };
  const mission2 = await app("/11/api/submit", { cookie, body: { week: 1, mission: "mission2", checklist } });
  assert.equal(mission2.status, 200);
  assert.equal((await mission2.json()).weekComplete, true);
  const anotherLogin = await app("/11/api/login", { body: { name: "다른샘", phone: "01000000002" } });
  const anotherCookie = anotherLogin.headers.get("set-cookie").split(";")[0];
  const links = await (await app("/11/api/links?week=1", { cookie: anotherCookie })).json();
  assert.equal(links.submissions[0].url, url);
  assert.equal(links.submissions[0].memberId, undefined);

  const after = await (await app(admin10)).json();
  assert.deepEqual(after.members, previous.members);
  assert.deepEqual(after.submissions, previous.submissions);
  assert.equal((await app("/11/api/logout", { method: "POST", cookie })).headers.get("set-cookie").includes("Max-Age=0"), true);
  assert.equal((await app("/11/api/me")).status, 401);
});
