// Extract named top-level function declarations from a tool's inline <script>
// so Node tests exercise the SHIPPED code, not a copy.
const fs = require('fs');
const path = require('path');

function sourceOf(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

// Pull `function name(...){...}` with balanced braces.
function extractFunction(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('function ' + name + ' not found');
  // skip the parameter list (may contain default-value braces like opts={})
  let p = src.indexOf('(', m.index), pd = 0;
  for (; p < src.length; p++) {
    if (src[p] === '(') pd++;
    else if (src[p] === ')') { pd--; if (pd === 0) break; }
  }
  let i = src.indexOf('{', p);
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(m.index, j + 1);
}

// Evaluate a set of functions from an HTML tool file into one sandbox object.
function loadFunctions(file, names, prelude = '') {
  const src = sourceOf(file);
  const code = names.map(n => extractFunction(src, n)).join('\n');
  const factory = new Function(prelude + '\n' + code + '\nreturn {' + names.join(',') + '};');
  return factory();
}

module.exports = { sourceOf, extractFunction, loadFunctions };
