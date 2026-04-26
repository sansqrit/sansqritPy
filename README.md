# SansqritPy — Sanskrit Visual Builder

[!\[License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[!\[Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

SansqritPy is a hybrid quantum-classical visual programming environment for building, simulating, exporting, and explaining quantum circuits and data workflows. It combines a drag-and-drop visual canvas with a Python-inspired Sanskrit DSL, a JavaScript quantum engine, ETL/data-science blocks, live visualizations, file upload support, project autosave, and a local web server.

* GitHub: [https://github.com/sansqrit/sansqritPy](https://github.com/sansqrit/sansqritPy)
* Website: [https://sansqrit-26c92.web.app/](https://sansqrit-26c92.web.app/)
* Local app URL after running: [http://localhost:3000](http://localhost:3000)

The project is designed so beginners can build circuits visually while advanced users can write code directly, inspect state vectors, run measurements, export circuits, and prototype applied workflows across quantum computing, ETL, data science, chemistry, finance, biology, climate, materials, optimization, and more.

\---

## Table of contents

1. [What this project does](#what-this-project-does)
2. [Feature overview](#feature-overview)
3. [Repository structure](#repository-structure)
4. [Prerequisites](#prerequisites)
5. [Quick start from GitHub](#quick-start-from-github)
6. [Running from a downloaded ZIP](#running-from-a-downloaded-zip)
7. [Starting the application](#starting-the-application)
8. [Using the visual builder](#using-the-visual-builder)
9. [Using the Sanskrit DSL](#using-the-sanskrit-dsl)
10. [Quantum examples](#quantum-examples)
11. [ETL and data science workflows](#etl-and-data-science-workflows)
12. [File upload and sample data](#file-upload-and-sample-data)
13. [Saving, loading, and autosave jobs](#saving-loading-and-autosave-jobs)
14. [Exporting circuits](#exporting-circuits)
15. [API reference](#api-reference)
16. [Testing](#testing)
17. [Precomputed quantum data](#precomputed-quantum-data)
18. [Configuration](#configuration)
19. [Troubleshooting](#troubleshooting)
20. [Security notes](#security-notes)
21. [Contributing](#contributing)
22. [License](#license)

\---

## What this project does

SansqritPy lets you create hybrid quantum-classical programs in two ways:

1. **Visual mode** — drag blocks onto a canvas, connect wires, edit block parameters, and run the workflow.
2. **Code mode** — write Sanskrit DSL code that looks close to Python but includes quantum primitives such as `qubits`, `H`, `CNOT`, `measure\_all`, and algorithm helpers.

The current codebase includes:

* A local Node.js HTTP server.
* A browser-based visual canvas.
* A JavaScript quantum simulator with complex amplitudes.
* A DSL interpreter.
* A standard library for math, statistics, arrays, strings, formatting, and quantum helper functions.
* ETL blocks for CSV, JSON, XML, Excel-like data parsing, filtering, joining, aggregation, pivoting, profiling, validation, and transformations.
* Data science blocks for normalization, encoding, regression, correlation, description, outlier detection, and train/test split style workflows.
* Built-in canvas examples and generated `.sanskrit` example programs.
* Job save/load and autosave folders.
* Live metrics through HTTP and Server-Sent Events.
* GitHub helper endpoints for local commit/push/pull workflows.

\---

## Feature overview

### Quantum computing

* Quantum registers and classical registers.
* Single-qubit gates including `H`, `X`, `Y`, `Z`, `S`, `Sdg`, `T`, rotations, and parameterized gates.
* Multi-qubit operations including `CNOT`, Toffoli, controlled gates, QFT, and algorithm blocks.
* Bell state, GHZ state, Grover search, QFT, teleportation-style helpers, and VQE-style stubs.
* Complex amplitude support.
* Measurement and histograms.
* State-vector inspection with top-N truncation for large registers.
* Sharded simulation support for large local sampling examples.
* Precomputed matrices and lookup tables for common gates and algorithms.

### Visual programming

* Drag-and-drop block palette.
* Canvas wires for data and quantum flow.
* Block properties panel.
* Visual examples.
* Multi-tab canvas autosave.
* `.sanskrit` save/load style JSON workflow files.
* Rich visual outputs such as tables, histograms, bar charts, line charts, scatter charts, heatmaps, gauges, and state-vector views.

### Sanskrit DSL

* Python-like syntax.
* Variables and arithmetic.
* `if`, `elif`, `else`.
* `for` and `while` loops.
* Functions and recursion.
* Lists, dictionaries, strings, and helper functions.
* Quantum functions.
* Simulation blocks.
* Formatting helpers.
* Statistical, array, math, and quantum utility functions.

### ETL and data science

* CSV, JSON, XML, and Excel-style upload handling.
* Filtering, joining, grouping, sorting, deduplication, validation, profiling, normalization, encoding, pivoting, and unpivoting.
* Data science transforms and statistical summaries.
* Sample datasets in `public/sample-data/`.

\---

## Repository structure

```text
sansqritPy/
├── bin/
│   └── sanskrit-repl.js              # CLI-style REPL entry point
├── jobs/                             # Saved and autosaved canvas jobs
├── logs/                             # Runtime logs created by the local server
├── precomputed/                      # Precomputed quantum lookup data
│   ├── circuit\_identities.json
│   ├── gate\_matrices.json
│   ├── grover\_table.json
│   ├── molecular\_energies.json
│   ├── molecule\_hamiltonians.json
│   ├── noise\_kraus.json
│   ├── pauli\_table.json
│   └── qft\_matrices.json
├── public/
│   ├── css/style.css                 # UI styles
│   ├── generated-examples/           # Many generated .sanskrit examples
│   ├── generated-examples-legacy/    # Legacy examples
│   ├── js/                           # Browser-side UI logic
│   ├── sample-data/                  # Example CSV datasets
│   ├── examples50.html               # Example gallery page
│   └── index.html                    # Main browser app
├── src/
│   ├── blocks/
│   │   ├── registry.js               # Main block registry
│   │   ├── registry\_extra.js
│   │   ├── registry\_extra\_b.js
│   │   └── registry\_domain\_expansion.js
│   ├── dsl/
│   │   ├── interpreter.js            # Sanskrit DSL interpreter
│   │   └── stdlib.js                 # DSL standard library
│   ├── engine/
│   │   └── quantum.js                # Quantum simulator and algorithms
│   ├── export/
│   │   └── circuit\_export.js         # Circuit export helpers
│   └── server/
│       └── server.js                 # Local Node.js HTTP server and APIs
├── tests/
│   ├── test.js                       # Core engine and DSL tests
│   └── test\_dsl\_advanced.js          # Advanced DSL and stdlib tests
├── BLOCK\_AUDIT.md                    # Block audit notes
├── BLOCK\_CATALOG.json                # Generated block catalog
├── CONTRIBUTING.md                   # Contributor guide
├── INSTALL.txt                       # Existing install notes
├── LICENSE                           # MIT license
├── package.json                      # Node package metadata
├── precompute.py                     # Precomputed data generator
├── settings.json                     # UI/runtime settings
├── START.sh                          # Unix/macOS start helper
├── START.bat                         # Windows start helper
├── START-heap.bat                    # Windows high-memory start helper
├── expand\_heap.sh                    # Unix/macOS heap helper
└── expand\_heap.bat                   # Windows heap helper
```

\---

## Prerequisites

### Required

1. **Git**

   Used to clone the repository.

   Check installation:

   ```bash
   git --version
   ```

2. **Node.js 18 or newer**

   The project is an ES module Node.js app and declares `node >=18.0.0`.

   Check installation:

   ```bash
   node --version
   npm --version
   ```

   Recommended: install the current LTS version from [https://nodejs.org/](https://nodejs.org/).

3. **Modern browser**

   Use Chrome, Edge, Firefox, Safari, or another modern browser that supports modern JavaScript, `fetch`, and Server-Sent Events.

   ### Optional but recommended

1. **Python 3**

   Python is useful for `precompute.py` and for server-side parsing helpers that call a Python standard-library script for some file formats.

   Check installation:

   ```bash
   python3 --version
   # or on Windows
   python --version
   ```

2. **A larger Node heap for large quantum examples**

   For large-qubit examples, use one of the heap helper scripts or start Node with `NODE\_OPTIONS`.

   Unix/macOS:

   ```bash
   NODE\_OPTIONS="--max-old-space-size=8192" npm start
   ```

   Windows PowerShell:

   ```powershell
   $env:NODE\_OPTIONS="--max-old-space-size=8192"
   npm start
   ```

   \---

   ## Quick start from GitHub

   ```bash
# 1. Clone the repository
git clone https://github.com/sansqrit/sansqritPy.git

# 2. Enter the project folder
cd sansqritPy

# 3. Confirm Node.js is available
node --version

# 4. Start the server
npm start

# 5. Open the app in your browser
# http://localhost:3000
```

   The project currently uses Node.js built-in modules only for the server. There are no external runtime dependencies listed in `package.json`, so `npm install` is usually not required before `npm start`. Running `npm install` is still safe if you want npm to verify or regenerate lockfile metadata.

   ```bash
npm install
npm start
```

   \---

   ## Running from a downloaded ZIP

   If you downloaded the project as a ZIP instead of cloning it:

   ```bash
# 1. Unzip the archive
unzip sansqritPy.zip

# 2. Enter the extracted folder
cd sansqritPy

# 3. Start the server
npm start

# 4. Open the browser
# http://localhost:3000
```

   On Windows, extract the ZIP with File Explorer, open PowerShell or Command Prompt inside the extracted folder, and run:

   ```powershell
npm start
```

   \---

   ## Starting the application



   Prerequisite checks:

   powershell -ExecutionPolicy Bypass -File .\\bootstrap\\check-requirements.ps1

   powershell -ExecutionPolicy Bypass -File .\\bootstrap\\check-requirements.ps1 -Install



   bash ./bootstrap/check-requirements.sh

   bash ./bootstrap/check-requirements.sh --install



   ### Standard start

   ```bash
npm start
```

   This runs:

   ```bash
node src/server/server.js
```

   Expected terminal output includes messages similar to:

   ```text
\[OK] Blocks  639 / 54 cats
\[OK] DSL     interpreter ready
\[OK] Server  http://localhost:3000
```

   Then open:

   ```text
http://localhost:3000
```

   ### Start with shell helpers

   Unix/macOS:

   ```bash
chmod +x START.sh
./START.sh
```

   Windows Command Prompt:

   ```bat
START.bat
```

   Windows high-memory helper:

   ```bat
START-heap.bat
```

   Unix/macOS high-memory helper:

   ```bash
chmod +x expand\_heap.sh
./expand\_heap.sh
```

   ### Custom port

   The server reads the `PORT` environment variable. To use a different port:

   Unix/macOS:

   ```bash
PORT=8080 npm start
```

   Windows PowerShell:

   ```powershell
$env:PORT="8080"
npm start
```

   Then open:

   ```text
http://localhost:8080
```

   \---

   ## Using the visual builder

1. Start the server with `npm start`.
2. Open `http://localhost:3000`.
3. Use the block palette to search or browse blocks.
4. Drag blocks onto the canvas.
5. Connect block outputs to compatible inputs using wires.
6. Click a block to edit its parameters.
7. Run or compile the workflow from the UI.
8. Inspect logs, output panels, tables, charts, state vectors, histograms, and metrics.
9. Save the canvas as a job or rely on autosave.

   Typical visual quantum workflow:

   ```text
Quantum Register → H Gate → CNOT Gate → Measure All → Histogram Chart
```

   Typical ETL workflow:

   ```text
CSV Reader → Filter Rows → Group By → Sort Rows → Table Display → Bar Chart
```

   Typical data science workflow:

   ```text
CSV Reader → Normalize → Encode → Correlation → Heatmap Chart
```

   \---

   ## Using the Sanskrit DSL

   The DSL is implemented in `src/dsl/interpreter.js` with helper functions in `src/dsl/stdlib.js`.

   ### Minimal program

   ```python
x = 5
y = x \* 2
print(y)
```

   Expected output:

   ```text
10
```

   ### Loops and functions

   ```python
def fact(n):
    if n <= 1:
        return 1
    return n \* fact(n - 1)

print(fact(5))
```

   Expected output:

   ```text
120
```

   ### Lists and statistics

   ```python
data = \[2, 4, 4, 4, 5, 5, 7, 9]
print(mean(data))
print(variance(data))
print(std(data))
```

   ### Quantum DSL example

   ```python
q = qubits(2)
H(q\[0])
CNOT(q\[0], q\[1])
measure\_all(q, shots=100)
print("Bell circuit complete")
```

   ### Simulation block

   ```python
simulate {
    q = qubits(2)
    H(q\[0])
    CNOT(q\[0], q\[1])
    print("sim\_ok")
}
```

   \---

   ## Quantum examples

   ### Bell state

   ```python
q = qubits(2)
H(q\[0])
CNOT(q\[0], q\[1])
measure\_all(q, shots=1000)
```

   The expected measurement distribution is concentrated on `00` and `11`.

   ### GHZ-style circuit

   ```python
q = qubits(5)
H(q\[0])
for i in range(4):
    CNOT(q\[i], q\[i + 1])
measure\_all(q, shots=1000)
```

   Expected output states are mainly `00000` and `11111`.

   ### Parameterized circuit

   ```python
q = qubits(4)
for i in range(4):
    Ry(q\[i], PI / 4)
for i in range(3):
    CNOT(q\[i], q\[i + 1])
measure\_all(q, shots=500)
```

   ### Grover search from the engine tests

   The test suite uses the JavaScript API directly:

   ```js
import { QAlgorithms } from './src/engine/quantum.js';

const result = QAlgorithms.grover(4, \[7], 600);
console.log(result.histogram);
```

   \---

   ## ETL and data science workflows

   The local server includes ETL handlers for common tabular operations. These are used by visual blocks through `/api/etl`.

   Supported workflow types include:

* CSV loading.
* JSON loading and flattening.
* XML loading and flattening.
* Excel-style `.xlsx` parsing through standard-library ZIP/XML parsing.
* Row filtering.
* Joining datasets.
* Grouping and aggregation.
* Sorting.
* Pivoting and unpivoting.
* Type casting.
* String trimming.
* Null handling.
* Deduplication.
* Dataset profiling.
* Validation.
* Normalization.
* Encoding.
* Correlation.
* Regression-style workflows.
* Chart and table output.

  Example visual pipeline:

  ```text
CSV Reader(customers.csv)
  → Drop Nulls(name,email)
  → Trim Strings
  → Profile
  → Table Display
```

  Example sales aggregation:

  ```text
CSV Reader(sales.csv)
  → Group By(region, product; revenue=sum; units=sum)
  → Sort Rows(total\_revenue desc)
  → Table Display
  → Bar Chart
```

  \---

  ## File upload and sample data

  Sample CSV files are included in:

  ```text
public/sample-data/customers.csv
public/sample-data/sales.csv
```

  The UI and server support uploaded file payloads for ETL blocks. Supported input styles include:

* Plain text content for CSV, JSON, and XML.
* Base64 content for binary-style uploads such as `.xlsx`.
* Browser file uploads through `/api/upload`.

  Supported or partially supported file extensions include:

  ```text
.csv
.json
.xml
.xlsx
.xls
```

  \---

  ## Saving, loading, and autosave jobs

  The project stores saved and autosaved canvases under:

  ```text
jobs/
```

  Common job endpoints:

* `POST /api/jobs/save`
* `POST /api/jobs/autosave`
* `POST /api/jobs/autosave-tabs`
* `GET /api/jobs/list`
* `GET /api/jobs/:id`

  A saved job usually contains a `canvas.json` file. Multi-tab autosaves contain a `manifest.json` plus one JSON file per tab.

  The generated job folders are local runtime artifacts. Do not commit personal or temporary jobs unless they are intended examples.

  \---

  ## Exporting circuits

  The project includes export helpers in:

  ```text
src/export/circuit\_export.js
```

  The server exposes:

  ```text
POST /api/export
```

  The DSL also contains circuit-style export methods for formats such as QASM-like output, IBM-style JSON, IonQ-style JSON, Cirq-like text, and Braket-like text.

  Because exporter support can vary by circuit feature, always inspect exported output before using it with external quantum providers or SDKs.

  \---

  ## API reference

  The local server is implemented in `src/server/server.js`.

  ### Health

  ```http
GET /api/health
```

  Returns server status, version, engine status, block count, category count, and uptime.

  Example:

  ```bash
curl http://localhost:3000/api/health
```

  ### Blocks

  ```http
GET /api/blocks
GET /api/blocks?id=h\_gate
```

  Returns the block registry or a specific block by ID.

  Example:

  ```bash
curl http://localhost:3000/api/blocks
curl "http://localhost:3000/api/blocks?id=h\_gate"
```

  ### Metrics

  ```http
GET /api/metrics
```

  Returns CPU, memory, uptime, and runtime information.

  ### Settings

  ```http
GET /api/settings
POST /api/settings
```

  Settings are stored in `settings.json`.

  ### Run DSL code

  ```http
POST /api/run
Content-Type: application/json

{
  "code": "q=qubits(2)\\nH(q\[0])\\nCNOT(q\[0],q\[1])\\nmeasure\_all(q,shots=100)\\nprint(\\"ok\\")"
}
```

  Example:

  ```bash
curl -X POST http://localhost:3000/api/run \\
  -H "Content-Type: application/json" \\
  -d '{"code":"x=5\\nprint(x\*2)"}'
```

  ### Compile DSL code

  ```http
POST /api/compile
```

  Compiles or translates code depending on the current server implementation.

  ### Run ETL operation

  ```http
POST /api/etl
Content-Type: application/json

{
  "operation": "csv\_reader",
  "params": { "filename": "customers.csv" },
  "inputs": {}
}
```

  ### Upload file

  ```http
POST /api/upload
```

  Supports JSON/base64 and multipart-style uploads from the UI.

  ### Samples

  ```http
GET /api/samples
```

  Lists built-in sample datasets.

  ### Examples

  ```http
GET /api/examples
GET /api/canvas-examples
```

  Returns built-in canvas examples.

  ### Server-Sent Events

  ```http
GET /api/events
```

  Used by the UI for live events and metrics-style updates.

  ### Logs

  ```http
POST /api/log/start
POST /api/log
GET /api/logs
GET /api/logs/:runName
```

  Logs are written under:

  ```text
logs/
```

  ### Local GitHub helper endpoints

  ```http
GET  /api/github/status
POST /api/github/init
POST /api/github/commit
POST /api/github/push
POST /api/github/pull
GET  /api/github/load-canvas
```

  These endpoints execute Git commands locally. Use them only in a trusted local development environment.

  \---

  ## Testing

  The repository contains two test suites.

  ### Core tests

  ```bash
node tests/test.js
```

  This covers:

* Bell state state vector.
* Bell state histogram.
* GHZ state.
* Rotation gates.
* Complex phase gates.
* Toffoli.
* Cross-shard CNOT.
* QFT.
* Expectation values.
* Grover.
* Large-register sampling.
* DSL basics.
* Loops, functions, recursion, lists, dicts, strings.
* Quantum DSL calls.

  Expected result:

  ```text
RESULT: 41 passed, 0 failed
All tests passed ✓
```

  ### Advanced DSL tests

  ```bash
node tests/test\_dsl\_advanced.js
```

  This covers:

* Math functions.
* Statistics.
* Arrays.
* Strings.
* Quantum utilities.
* Formatting.
* Recursion.
* Matrix operations.
* Monte Carlo example.

  Expected result:

  ```text
Advanced DSL: 39 tests  ✅ 39 passed  ❌ 0 failed
```

  ### Run all tests manually

  The current `package.json` only defines `npm start`, so run both test files directly:

  ```bash
node tests/test.js
node tests/test\_dsl\_advanced.js
```

  Optional: add a local script to `package.json` if you want `npm test` support:

  ```json
{
  "scripts": {
    "start": "node src/server/server.js",
    "test": "node tests/test.js \&\& node tests/test\_dsl\_advanced.js",
    "test:all": "node tests/test.js \&\& node tests/test\_dsl\_advanced.js"
  }
}
```

  \---

  ## Precomputed quantum data

  Precomputed lookup files live in:

  ```text
precomputed/
```

  They include gate matrices, Pauli tables, QFT matrices, Grover lookup data, circuit identities, molecular energies, molecule Hamiltonians, and noise Kraus data.

  To regenerate or update precomputed data, inspect and run:

  ```bash
python3 precompute.py
```

  On Windows:

  ```powershell
python precompute.py
```

  Only commit regenerated files when the change is intentional and tests still pass.

  \---

  ## Configuration

  Runtime and UI settings are stored in:

  ```text
settings.json
```

  The server provides `/api/settings` for reading and updating settings.

  Typical settings include UI preferences such as theme, font size, table page size, autosave, grid snapping, and keyboard shortcuts.

  \---

  ## Troubleshooting

  ### `node: command not found`

  Install Node.js 18 or newer, then reopen your terminal.

  Check:

  ```bash
node --version
```

  ### `Cannot use import statement outside a module`

  Make sure you are running from this project folder and that `package.json` contains:

  ```json
"type": "module"
```

  Start with:

  ```bash
npm start
```

  ### Port 3000 is already in use

  Use another port:

  ```bash
PORT=8080 npm start
```

  Windows PowerShell:

  ```powershell
$env:PORT="8080"
npm start
```

  ### Browser cannot open the app

  Confirm the server is still running and visit:

  ```text
http://localhost:3000
```

  Do not close the terminal running `npm start`.

  ### Large quantum examples are slow or memory-heavy

  Use a larger Node heap:

  ```bash
NODE\_OPTIONS="--max-old-space-size=8192" npm start
```

  Use fewer shots or fewer qubits while developing.

  ### Python-dependent parsing fails

  Install Python 3 and confirm it is available:

  ```bash
python3 --version
```

  or:

  ```bash
python --version
```

  You can also set a specific Python executable:

  ```bash
PYTHON=/path/to/python3 npm start
```

  ### Tests take time on large-register cases

  The core test suite includes large-register quantum simulation checks. This is expected. Let the test process finish before assuming it has failed.

  \---

  ## Security notes

  SansqritPy is intended for local development and experimentation.

  Be careful with:

* `/api/github/\*` endpoints, because they execute local Git commands.
* Uploaded files, because parsing happens on the local server.
* Generated jobs and logs, because they may contain local data or workflow content.
* Running the server on public networks.

  Recommended local-only use:

  ```bash
npm start
# open only from your local browser
```

  Do not expose this development server directly to the internet without authentication, input hardening, and a security review.

  \---

  ## Contributing

  Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

  Before opening a pull request:

  ```bash
node tests/test.js
node tests/test\_dsl\_advanced.js
```

  Both suites should pass.

  \---

  ## License

  This project is licensed under the MIT License. See [LICENSE](LICENSE).

