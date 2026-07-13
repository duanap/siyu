import { readFile } from 'node:fs/promises';
import process from 'node:process';
import YAML from 'yaml';

const contractPath = 'docs/architecture/API_CONTRACT.md';
const openapiPath = 'docs/architecture/openapi.yaml';
const approvedOperationCount = 74;
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

const contract = await readFile(contractPath, 'utf8');
const openapi = YAML.parse(await readFile(openapiPath, 'utf8'));
const contractPattern = /^- `(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE) ([^`]+)`$/gm;

const normalizeContractPath = (path) => path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, '{$1}');
const contractOperations = new Set();
let match;

while ((match = contractPattern.exec(contract)) !== null) {
  contractOperations.add(`${match[1].toLowerCase()} ${normalizeContractPath(match[2])}`);
}

const openapiOperations = new Set();
for (const [path, pathItem] of Object.entries(openapi.paths ?? {})) {
  for (const method of Object.keys(pathItem ?? {})) {
    if (methods.has(method.toLowerCase())) {
      openapiOperations.add(`${method.toLowerCase()} ${path}`);
    }
  }
}

const missing = [...contractOperations].filter((operation) => !openapiOperations.has(operation));
const undocumented = [...openapiOperations].filter(
  (operation) => !contractOperations.has(operation),
);
const problems = [];

if (contractOperations.size !== approvedOperationCount) {
  problems.push(
    `API_CONTRACT contains ${contractOperations.size} operations; expected ${approvedOperationCount}.`,
  );
}
if (missing.length > 0) problems.push(`Missing from OpenAPI: ${missing.join(', ')}`);
if (undocumented.length > 0)
  problems.push(`Not approved by API_CONTRACT: ${undocumented.join(', ')}`);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log(`OpenAPI covers all ${approvedOperationCount} approved API operations.`);
