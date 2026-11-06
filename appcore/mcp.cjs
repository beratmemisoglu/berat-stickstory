// The "suite" MCP server for interactive Claude Code sessions in berat studio: every Claude tool of berat studio
// (render_frames, check_preview, check_layout, list_shots, narration, make_image, make_sprites, web_image, lowpoly_asset,
// library_*, enrich_frame, make_target, match_shot, critic_shot, sound_effects, ...), straight from the app's own tool
// definitions (suiteToolDefs) for the open project, built the way the app's bridge builds them (McpServer + zod).
// The open project: `python studio.py use <name>` (toon-studio/.active-project), or the folder Claude runs in.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { load, ROOT } = require('./load.cjs');
const A = load(['suiteToolDefs', 'getProject', 'q', 'startServer', 'register', 'listPresets', 'writeContext', 'zod']);

function activeProject() {
  const dirs = [process.cwd(), (() => { try { return fs.readFileSync(path.join(ROOT, '.active-project'), 'utf8').trim(); } catch { return null; } })()];
  const dir = dirs.find((d) => d && fs.existsSync(path.join(d, 'project.json')));
  if (!dir) return null;
  let p = A.q.get('SELECT * FROM projects WHERE path=?', path.resolve(dir));
  if (!p) {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8').replace(/^﻿/, '')), style = pj.style || 'pixel-art';
    p = A.register(path.resolve(dir), pj.title || path.basename(dir), A.listPresets().find((x) => (x.style_id || 'pixel-art') === style)?.id ?? null, style);
  }
  return p;
}

(async () => {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  await A.startServer();
  const p = activeProject();
  const mcp = new McpServer({ name: 'suite', version: '1.0.0' }, {
    instructions: p ? `berat studio tools for the open project "${p.name}" (${p.style_id}, ${p.path}): they work exactly like inside the app. Read its CLAUDE.md first.`
      : 'No project is open: run `python studio.py use <name>` (or start Claude Code inside a project folder), then reconnect this server (/mcp).'
  });
  if (p) {
    for (const d of A.suiteToolDefs(p.id, [], null)) {
      mcp.tool(d.name, d.description, d.schema, async (args) => {
        try { return await d.handler(args); }
        catch (e) { return { content: [{ type: 'text', text: `${d.name}: ${e?.message || e}` }], isError: true }; }
      });
    }
  }
  await mcp.connect(new StdioServerTransport());
})().catch((e) => { console.error(e); process.exit(1); });
