# Contributing to SansqritPy

Thank you for contributing to SansqritPy. This project combines a visual programming UI, a local Node.js server, a Sanskrit DSL interpreter, a JavaScript quantum engine, ETL/data-science operations, generated examples, and tests. Small, well-tested changes are strongly preferred.

---

## Table of contents

1. [Contribution principles](#contribution-principles)
2. [Development prerequisites](#development-prerequisites)
3. [Set up your local development environment](#set-up-your-local-development-environment)
4. [Branch workflow](#branch-workflow)
5. [Running the app locally](#running-the-app-locally)
6. [Running tests](#running-tests)
7. [Project areas](#project-areas)
8. [Adding or changing a visual block](#adding-or-changing-a-visual-block)
9. [Adding or changing a DSL feature](#adding-or-changing-a-dsl-feature)
10. [Adding standard-library functions](#adding-standard-library-functions)
11. [Adding ETL or data-science operations](#adding-etl-or-data-science-operations)
12. [Changing the quantum engine](#changing-the-quantum-engine)
13. [Adding examples](#adding-examples)
14. [Updating precomputed data](#updating-precomputed-data)
15. [Code style](#code-style)
16. [Testing expectations](#testing-expectations)
17. [Commit message guidance](#commit-message-guidance)
18. [Pull request checklist](#pull-request-checklist)
19. [Bug reports](#bug-reports)
20. [Feature requests](#feature-requests)
21. [Security reports](#security-reports)

---

## Contribution principles

1. Keep changes focused.
2. Add or update tests for behavioral changes.
3. For quantum physics or numerical bugs, add a failing test first when possible.
4. Do not commit temporary jobs, logs, personal datasets, or generated local noise unless they are intentionally part of an example.
5. Prefer readable code over clever code.
6. Keep the project runnable with Node.js built-ins unless a dependency is truly necessary.
7. Document user-facing changes in `README.md` or relevant example files.

---

## Development prerequisites

Required:

- Git.
- Node.js 18 or newer.
- npm.
- A modern browser.

Recommended:

- Python 3 for `precompute.py` and optional server-side file parsing helpers.
- A code editor with JavaScript, HTML, CSS, JSON, and Markdown support.

Check your environment:

```bash
git --version
node --version
npm --version
python3 --version
```

On Windows, Python may be available as:

```powershell
python --version
```

---

## Set up your local development environment

### 1. Fork the repository

Fork the project on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR-USERNAME/sansqritPy.git
cd sansqritPy
```

### 2. Add the upstream remote

```bash
git remote add upstream https://github.com/sansqrit/sansqritPy.git
git remote -v
```

### 3. Start from the latest main branch

```bash
git checkout main
git pull upstream main
```

### 4. Optional npm install

The current server uses built-in Node.js modules and does not require external runtime dependencies. You may still run:

```bash
npm install
```

---

## Branch workflow

Create a focused branch:

```bash
git checkout -b feature/add-new-quantum-block
```

Examples:

```bash
git checkout -b fix/bell-state-histogram
git checkout -b docs/improve-install-guide
git checkout -b test/add-qft-edge-cases
git checkout -b refactor/etl-upload-parser
```

Keep your branch updated:

```bash
git fetch upstream
git rebase upstream/main
```

---

## Running the app locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Use another port if needed:

```bash
PORT=8080 npm start
```

For large quantum examples:

```bash
NODE_OPTIONS="--max-old-space-size=8192" npm start
```

Windows PowerShell:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm start
```

---

## Running tests

Run the core suite:

```bash
node tests/test.js
```

Run the advanced DSL suite:

```bash
node tests/test_dsl_advanced.js
```

Run both:

```bash
node tests/test.js && node tests/test_dsl_advanced.js
```

Expected results:

```text
RESULT: 41 passed, 0 failed
Advanced DSL: 39 tests  ✅ 39 passed  ❌ 0 failed
```

The current `package.json` only defines `npm start`. If you add npm test scripts, keep direct Node commands working too.

Suggested scripts:

```json
{
  "scripts": {
    "start": "node src/server/server.js",
    "test": "node tests/test.js && node tests/test_dsl_advanced.js",
    "test:all": "node tests/test.js && node tests/test_dsl_advanced.js"
  }
}
```

---

## Project areas

### Visual UI

Main files:

```text
public/index.html
public/css/style.css
public/js/app.js
public/js/canvas.js
public/js/palette.js
public/js/properties.js
```

Use these files for canvas behavior, palette rendering, property panels, run/compile UI, metrics display, examples, and browser interactions.

### Server

Main file:

```text
src/server/server.js
```

Use this for API endpoints, static file serving, ETL handlers, upload handling, metrics, logs, jobs, and local Git helper endpoints.

### Blocks

Main files:

```text
src/blocks/registry.js
src/blocks/registry_extra.js
src/blocks/registry_extra_b.js
src/blocks/registry_domain_expansion.js
BLOCK_CATALOG.json
BLOCK_AUDIT.md
```

Use these when adding visual blocks, categories, parameters, inputs, outputs, or DSL generation hooks.

### DSL

Main files:

```text
src/dsl/interpreter.js
src/dsl/stdlib.js
```

Use these for language parsing, evaluation, runtime behavior, built-in functions, and helper libraries.

### Quantum engine

Main file:

```text
src/engine/quantum.js
```

Use this for quantum register behavior, gates, measurement, state-vector logic, sharding, algorithms, and precomputed lookup integration.

### Exporters

Main file:

```text
src/export/circuit_export.js
```

Use this for circuit output formats.

### Tests

Main files:

```text
tests/test.js
tests/test_dsl_advanced.js
```

Add coverage here for new behavior.

---

## Adding or changing a visual block

Visual blocks are defined in the block registry. A block typically includes:

- `id` — stable machine-readable identifier.
- `label` — user-facing name.
- `cat` — category key.
- `color` — UI color.
- `icon` — small display icon or text.
- `info` — help text.
- `params` — editable block parameters.
- `inputs` — input ports.
- `outputs` — output ports.
- `toSq` — optional conversion to Sanskrit DSL/code.

Example block shape:

```js
{
  id: 'my_block',
  label: 'My Block',
  cat: 'utility',
  color: '#64748B',
  icon: '🧩',
  info: 'Explain what the block does in one or two sentences.',
  params: [
    { name: 'value', type: 'number', default: 1, label: 'Value' }
  ],
  inputs: [
    { name: 'in', type: 'any' }
  ],
  outputs: [
    { name: 'out', type: 'any' }
  ],
  toSq: (b) => `print(${JSON.stringify(b.params.value)})`
}
```

### Checklist for block changes

- Use a stable `id`; avoid renaming existing IDs because saved canvases may depend on them.
- Put the block in the most accurate category.
- Add clear `info` text.
- Define sensible defaults for all parameters.
- Keep input and output port names stable.
- Add or update visual examples if the block is user-facing.
- Add tests if the block maps to DSL, ETL, or quantum behavior.

---

## Adding or changing a DSL feature

DSL behavior lives mostly in:

```text
src/dsl/interpreter.js
```

When adding syntax or runtime behavior:

1. Add a failing test in `tests/test.js` or `tests/test_dsl_advanced.js`.
2. Implement the parser/evaluator change.
3. Test basic behavior.
4. Test edge cases.
5. Add a README example if the feature is user-facing.

Example DSL test pattern:

```js
await dsl(
  'my new DSL feature',
  'x=5\nprint(x)',
  '5'
);
```

For advanced tests:

```js
await test('my stdlib feature', async () => {
  const { get } = await run(`let x = my_func(2)`);
  assert(get('x') === 4);
});
```

---

## Adding standard-library functions

Standard-library helpers live in:

```text
src/dsl/stdlib.js
```

Common areas include:

- Math.
- Statistics.
- Arrays.
- Strings.
- Formatting.
- Quantum utilities.
- Dictionary helpers.
- Random helpers.

Example contribution flow:

1. Add the function in `stdlib.js`.
2. Make sure it validates input where appropriate.
3. Add a test in `tests/test_dsl_advanced.js`.
4. Add a small DSL example if useful.

Example test:

```js
await test('my_helper works', async () => {
  const { get } = await run(`let y = my_helper(10)`);
  assert(get('y') === 20);
});
```

---

## Adding ETL or data-science operations

ETL handlers are implemented in the server and are called by visual blocks through `/api/etl`.

Typical flow:

1. Add the block definition to the registry.
2. Add the operation handler in `src/server/server.js`.
3. Make sure the handler accepts:

   ```js
   function(params, inputs, uploadedData, uploadedFile) { ... }
   ```

4. Return a predictable object, usually including:

   ```js
   {
     dataset: { columns, rows, total_rows, types },
     log: 'Human-readable operation summary'
   }
   ```

5. Add or update examples.
6. Add tests where possible.

### ETL handler guidelines

- Do not mutate input datasets unless intentional.
- Preserve `row_id` when possible.
- Return clear error messages.
- Limit very large preview rows where the UI expects previews.
- Keep parsing safe and local.
- Avoid adding heavy dependencies unless necessary.

---

## Changing the quantum engine

Quantum engine changes are high-impact. The main file is:

```text
src/engine/quantum.js
```

Before changing quantum behavior:

1. Add a failing test that demonstrates the issue.
2. Include expected amplitudes, probabilities, or measurement constraints.
3. Check complex phase behavior, not only measurement counts.
4. Consider edge cases across small and larger registers.
5. Run both test suites.

Important existing test areas include:

- Bell state state vector and histogram.
- GHZ states.
- `Ry` probabilities.
- `Y`, `T`, and complex phase behavior.
- Toffoli.
- Cross-shard CNOT.
- QFT.
- Expectation values.
- Grover search.
- Large-register top-N state-vector behavior.

### Quantum test example

```js
await test('Bell state — state vector', async () => {
  const q = new QuantumRegister('q', 2);
  q.H(0);
  q.CNOT(0, 1);
  const sv = q.statevector();
  if (sv.length !== 2) throw new Error(`got ${sv.length} states`);
  if (Math.abs(sv[0].prob - 0.5) > 0.001) throw new Error(`prob=${sv[0].prob}`);
});
```

---

## Adding examples

Examples live in:

```text
public/generated-examples/
public/generated-examples-legacy/
public/examples50.html
```

When adding an example:

- Use a descriptive filename.
- Keep it runnable.
- Prefer realistic parameter values.
- Include blocks and wires clearly.
- Avoid personal or private data.
- For large-qubit examples, keep runtime reasonable or label them clearly.

Good example names:

```text
quantum_bell_state.sanskrit
etl_sales_pipeline.sanskrit
ml_regression_pipeline.sanskrit
complex_quantum_security_suite.sanskrit
```

---

## Updating precomputed data

Precomputed files live in:

```text
precomputed/
```

Generator:

```text
precompute.py
```

Run:

```bash
python3 precompute.py
```

or on Windows:

```powershell
python precompute.py
```

After regenerating:

```bash
git diff precomputed/
node tests/test.js
node tests/test_dsl_advanced.js
```

Only commit regenerated JSON files when the change is intended and explain why in the pull request.

---

## Code style

### JavaScript

- Use ES modules.
- Prefer `const` unless reassignment is needed.
- Prefer readable function names.
- Keep functions focused.
- Use clear error messages.
- Avoid adding global state unless necessary.
- Avoid introducing dependencies without discussion.

### HTML/CSS/UI

- Keep UI labels short and understandable.
- Preserve keyboard shortcut behavior.
- Avoid breaking existing element IDs used by JavaScript.
- Test in at least one modern browser.

### JSON examples

- Keep files valid JSON.
- Use stable IDs where saved canvases reference blocks.
- Do not include private data.

### Markdown

- Keep setup commands copy-pasteable.
- Update README when commands, endpoints, or prerequisites change.
- Mention OS-specific differences where needed.

---

## Testing expectations

Every pull request should run:

```bash
node tests/test.js
node tests/test_dsl_advanced.js
```

Add tests when changing:

- Quantum gates or algorithms.
- DSL syntax or runtime semantics.
- Standard-library functions.
- ETL/data-science logic.
- Export output.
- Block-to-DSL generation.

Documentation-only changes may not need new tests, but the app should still start if setup instructions were edited.

---

## Commit message guidance

Use short, clear commit messages.

Recommended prefixes:

```text
feat: add qaoa visual block
fix: correct y gate complex phase
docs: expand install instructions
test: add qft edge cases
refactor: simplify etl upload parser
chore: regenerate block catalog
```

Examples:

```bash
git commit -m "feat: add controlled rotation block"
git commit -m "fix: preserve row_id during joins"
git commit -m "docs: document local API endpoints"
```

---

## Pull request checklist

Before opening a pull request, confirm:

- [ ] The branch is based on the latest `main`.
- [ ] The change is focused and easy to review.
- [ ] The app starts with `npm start`.
- [ ] `node tests/test.js` passes.
- [ ] `node tests/test_dsl_advanced.js` passes.
- [ ] New behavior has tests.
- [ ] User-facing behavior is documented.
- [ ] No private data, logs, or temporary jobs were committed.
- [ ] Large generated files are intentional.
- [ ] The pull request description explains what changed and why.

Suggested PR description:

```markdown
## Summary

Explain the change in 2–4 sentences.

## Why

Explain the problem or feature request.

## Testing

- [x] npm start
- [x] node tests/test.js
- [x] node tests/test_dsl_advanced.js

## Notes

Mention any limitations, follow-ups, or migration concerns.
```

---

## Bug reports

A good bug report includes:

- What you expected to happen.
- What actually happened.
- Steps to reproduce.
- Browser and operating system.
- Node.js version.
- Console logs or terminal errors.
- Minimal DSL code or canvas JSON when relevant.

Example:

```markdown
## Bug

Bell state histogram shows unexpected states.

## Steps

1. Start `npm start`.
2. Open `http://localhost:3000`.
3. Build Quantum Register → H → CNOT → Measure All.
4. Run with 1000 shots.

## Expected

Only `00` and `11` states.

## Actual

Other states appear.

## Environment

- OS: macOS / Windows / Linux
- Node: vXX.YY.ZZ
- Browser: Chrome / Firefox / Edge
```

---

## Feature requests

A good feature request includes:

- The user problem.
- Proposed behavior.
- Example workflow.
- Whether it belongs in visual blocks, DSL, server API, exports, or docs.
- Any related quantum, ETL, or data-science references.

Example:

```markdown
## Feature

Add a QAOA block for MaxCut demos.

## Use case

Users should be able to drag a graph input block, connect it to QAOA, and view sampled bitstrings.

## Suggested API

Block params: p, shots, optimizer, graph.

## Tests

Add a small 3-node graph test with deterministic seed.
```

---

## Security reports

Do not open public issues for security-sensitive reports.

Potentially sensitive areas include:

- File upload parsing.
- Local Git helper endpoints.
- Server command execution.
- Job and log contents.
- Any path traversal or arbitrary file read/write behavior.

Please report privately to the project maintainer or repository owner.

---

## Maintainer notes

Before merging:

- Review block ID compatibility.
- Check saved canvas compatibility.
- Confirm no accidental logs or jobs were committed.
- Confirm generated files are intentional.
- Re-run both test suites.
- Verify the UI loads at `http://localhost:3000`.

Thank you for helping improve SansqritPy.
