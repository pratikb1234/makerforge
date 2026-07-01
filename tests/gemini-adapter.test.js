// Gemini provider adapter for the AI copilot — schema conversion and
// Anthropic-format → Gemini-contents history translation, including the
// thoughtSignature round-trip (_graw replay). Tests shipped code.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };

const { toGeminiSchema, geminiToolDecls, toGeminiContents } =
  loadFunctions('cad-studio.html', ['toGeminiSchema', 'geminiToolDecls', 'toGeminiContents']);

// ---- schema conversion ----
const s = toGeminiSchema({ type: 'object', properties: {
  kind: { type: 'string', enum: ['box', 'cylinder'] },
  ids: { type: 'array', items: { type: 'integer' } },
  pos: { type: 'object', properties: { x: { type: 'number' } } },
  on: { type: 'boolean', description: 'flag' },
}, required: ['kind'] });
ok(s.type === 'OBJECT', 'object → OBJECT');
ok(s.properties.kind.type === 'STRING' && s.properties.kind.enum.length === 2, 'string+enum kept');
ok(s.properties.ids.type === 'ARRAY' && s.properties.ids.items.type === 'INTEGER', 'array items converted');
ok(s.properties.pos.properties.x.type === 'NUMBER', 'nested objects converted');
ok(s.properties.on.description === 'flag', 'descriptions kept');
ok(s.required.join() === 'kind', 'required kept');

// ---- tool declarations ----
const decls = geminiToolDecls([
  { name: 'get_scene', description: 'read', input_schema: { type: 'object', properties: {} } },
  { name: 'add_body', description: 'add', input_schema: { type: 'object', properties: { kind: { type: 'string' } }, required: ['kind'] } },
])[0].functionDeclarations;
ok(decls.length === 2, 'two declarations');
ok(!('parameters' in decls[0]), 'no-arg tool omits parameters (Gemini rejects empty OBJECT)');
ok(decls[1].parameters.type === 'OBJECT', 'parameterised tool converted');

// ---- history translation ----
const toolNames = { t1: 'get_scene', t2: 'add_body' };
const graw = { role: 'model', parts: [{ functionCall: { name: 'add_body', args: { kind: 'box' } }, thoughtSignature: 'SIG' }] };
const history = [
  { role: 'user', content: 'add a cube' },
  { role: 'assistant', content: [{ type: 'text', text: 'looking' }, { type: 'tool_use', id: 't1', name: 'get_scene', input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"features":[]}' }] },
  { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'add_body', input: { kind: 'box' } }], _graw: graw },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't2', content: 'not-json' }] },
];
const c = toGeminiContents(history, toolNames);
ok(c.length === 5, 'one content per message');
ok(c[0].role === 'user' && c[0].parts[0].text === 'add a cube', 'plain user text');
ok(c[1].role === 'model' && c[1].parts[0].text === 'looking' && c[1].parts[1].functionCall.name === 'get_scene', 'assistant blocks → model parts');
ok(c[2].parts[0].functionResponse.name === 'get_scene', 'tool_result name resolved via id map');
ok(c[2].parts[0].functionResponse.response.result.features.length === 0, 'JSON result parsed');
ok(c[3] === graw && c[3].parts[0].thoughtSignature === 'SIG', '_graw replayed VERBATIM (thoughtSignature preserved)');
ok(c[4].parts[0].functionResponse.response.result.raw === 'not-json', 'non-JSON result wrapped, not dropped');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
