# Security Analysis Report - iFood Integration
**Generated:** 2026-01-05  
**Reviewed by:** GitHub Copilot Security Review  
**Repository:** diegosanchespereira1/app-restaurante

## Executive Summary

This security audit examined the iFood integration implementation focusing on:
- Authentication & Authorization
- Data encryption & storage
- API security & input validation
- Secret management
- SQL injection vulnerabilities
- Information disclosure
- Error handling

## Security Findings

### 🔴 CRITICAL VULNERABILITIES

#### 1. **Weak Default Encryption Key**
**Location:** `backend/src/utils/encryption.ts:17-19`
**Severity:** CRITICAL
**Description:** The system uses a hardcoded default encryption key when `IFOOD_ENCRYPTION_KEY` environment variable is not set.

```typescript
// Default key for development only - should be changed in production
return crypto.scryptSync('default-key-change-in-production', 'salt', KEY_LENGTH)
```

**Impact:**
- All sensitive data (client secrets, API keys) encrypted with this default key can be decrypted by anyone who has access to the codebase
- Attackers can decrypt iFood credentials stored in the database

**Recommendation:**
- **IMMEDIATE:** Make `IFOOD_ENCRYPTION_KEY` mandatory - application should fail to start if not set
- Add startup validation to check for encryption key presence
- Generate unique encryption keys for each deployment
- Rotate any credentials that were encrypted with the default key

**Fix:**
```typescript
function getEncryptionKey(): Buffer {
  const key = process.env.IFOOD_ENCRYPTION_KEY
  
  if (!key) {
    throw new Error('IFOOD_ENCRYPTION_KEY environment variable is required for production')
  }
  
  // Validate key length
  if (key.length < 32) {
    throw new Error('IFOOD_ENCRYPTION_KEY must be at least 32 characters')
  }
  
  // If key is provided as hex string, convert it
  if (key.length === KEY_LENGTH * 2) {
    return Buffer.from(key, 'hex')
  }
  
  // Otherwise, derive key from the string
  return crypto.scryptSync(key, 'ifood-salt', KEY_LENGTH)
}
```

#### 2. **Missing .env File from .gitignore**
**Location:** `.gitignore`
**Severity:** CRITICAL
**Description:** The `.gitignore` file does not explicitly exclude `.env` files, and a `.env` file exists in the repository.

**Current .gitignore:**
```
# Missing these critical exclusions:
# .env
# .env.local
# .env.*.local
```

**Impact:**
- Environment files containing secrets may be accidentally committed to the repository
- Secrets can be exposed in git history even if later removed

**Recommendation:**
- **IMMEDIATE:** Add `.env*` to `.gitignore`
- Check git history for any committed secrets
- Rotate all credentials if any were committed
- Use `git-secrets` or similar tools to prevent future accidental commits

**Fix:**
```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.production
.env.development

# Sensitive files
*.pem
*.key
*.cert
```

### 🟠 HIGH VULNERABILITIES

#### 3. **No Authentication/Authorization on API Endpoints**
**Location:** `backend/src/routes/ifood.ts` (all routes)
**Severity:** HIGH
**Description:** All iFood API endpoints lack authentication and authorization middleware. Any user who can reach the backend can:
- Configure iFood credentials
- View iFood orders and customer data
- Accept/cancel orders
- View merchant statistics
- Update order statuses

**Example vulnerable endpoints:**
```typescript
// No authentication middleware
router.post('/config', async (req: Request, res: Response) => {
  const { merchant_id, client_id, client_secret, ... } = req.body
  // Anyone can set credentials!
})

router.get('/pending-orders', async (req: Request, res: Response) => {
  // Anyone can view orders!
})

router.post('/accept-order/:orderId', async (req: Request, res: Response) => {
  // Anyone can accept orders!
})
```

**Impact:**
- Unauthorized users can steal customer data (names, addresses, phone numbers)
- Competitors can spy on order volumes and pricing
- Malicious actors can accept/cancel orders causing business disruption
- Unauthorized credential changes can break the integration

**Recommendation:**
- Implement JWT or session-based authentication middleware
- Add role-based access control (RBAC)
- Require admin role for configuration endpoints
- Require staff/manager role for order management endpoints
- Log all access attempts for audit trails

**Fix:**
```typescript
// Add authentication middleware
import { authenticateToken, requireRole } from '../middleware/auth'

// Protected routes
router.post('/config', authenticateToken, requireRole('admin'), async (req, res) => {
  // Only admins can configure
})

router.get('/pending-orders', authenticateToken, requireRole('staff'), async (req, res) => {
  // Staff can view orders
})

router.post('/accept-order/:orderId', authenticateToken, requireRole('staff'), async (req, res) => {
  // Staff can accept orders
})
```

#### 4. **Client Secret Exposure in API Response**
**Location:** `backend/src/routes/ifood.ts:124-126`
**Severity:** HIGH
**Description:** While the code attempts to exclude `client_secret` from responses, it's not consistently applied across all endpoints.

```typescript
// Good: client_secret is excluded
const { client_secret, ...safeConfig } = config
res.json({ success: true, config: safeConfig })
```

**However,** the `/config` POST endpoint at line 23 accepts and stores `client_secret` directly from user input without validation.

**Impact:**
- Client secret could be exposed in error messages or logs
- Client secret is stored in plaintext in transit (HTTP POST body)
- No validation of secret format/strength

**Recommendation:**
- Always use HTTPS for API calls
- Add input validation for credentials
- Sanitize all error messages to prevent secret leakage
- Implement rate limiting on authentication endpoints
- Add audit logging for credential access

#### 5. **Insufficient Input Validation**
**Location:** Multiple endpoints in `backend/src/routes/ifood.ts`
**Severity:** HIGH
**Description:** User input is not properly validated before use, allowing potential injection attacks and malformed data processing.

**Examples:**
```typescript
// No validation of IDs
router.delete('/mapping/:id', async (req, res) => {
  const { id } = req.params // No validation!
  await supabase.from('ifood_product_mapping').delete().eq('id', id)
})

// No validation of merchant_id format
const { merchant_id, client_id, client_secret } = req.body
```

**Impact:**
- SQL injection (mitigated by Supabase, but defense-in-depth is important)
- XSS if IDs are reflected in responses
- DoS through malformed input
- Logic errors from unexpected data types

**Recommendation:**
- Validate all inputs using a schema validator (e.g., Zod, Joi)
- Sanitize user input before processing
- Validate UUID/ID formats
- Implement length limits on string inputs
- Reject requests with invalid data early

**Fix:**
```typescript
import { z } from 'zod'

const configSchema = z.object({
  merchant_id: z.string().uuid(),
  client_id: z.string().min(10).max(255),
  client_secret: z.string().min(20).max(255),
  polling_interval: z.number().int().min(10).max(3600),
  is_active: z.boolean().optional()
})

router.post('/config', async (req, res) => {
  const validation = configSchema.safeParse(req.body)
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input',
      errors: validation.error.errors
    })
  }
  const data = validation.data
  // ... process validated data
})
```

### 🟡 MEDIUM VULNERABILITIES

#### 6. **Insecure CORS Configuration**
**Location:** `backend/src/server.ts:23-35`
**Severity:** MEDIUM
**Description:** CORS policy allows any origin containing 'github.io', which is overly permissive.

```typescript
if (allowedOrigins.includes(origin) || origin.includes('github.io')) {
  callback(null, true)
}
```

**Impact:**
- Any GitHub Pages site can make requests to the API
- Attackers hosting malicious sites on GitHub Pages can access the API
- CSRF attacks possible from untrusted origins

**Recommendation:**
- Use exact origin matching only
- Remove the `origin.includes('github.io')` check
- Implement CSRF tokens for state-changing operations
- Add Content-Security-Policy headers

**Fix:**
```typescript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      // Reject requests with no origin in production
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Origin required'))
      }
      return callback(null, true)
    }
    
    // Exact match only
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
```

#### 7. **Excessive Error Information Disclosure**
**Location:** Multiple locations throughout `backend/src/routes/ifood.ts`
**Severity:** MEDIUM
**Description:** Error messages contain too much technical detail and stack traces in production.

```typescript
res.status(500).json({
  success: false,
  message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
  error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
})
```

**While this is better for development,** many other endpoints don't check `NODE_ENV` and expose full error details:

```typescript
// Line 104
message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
// Exposes internal errors always!
```

**Impact:**
- Attackers learn about internal system architecture
- Database schema information leakage
- Technology stack disclosure helps target attacks
- Path traversal information in stack traces

**Recommendation:**
- Create generic error messages for production
- Log detailed errors server-side only
- Implement error monitoring (e.g., Sentry)
- Never expose stack traces in production
- Use error codes instead of descriptive messages

**Fix:**
```typescript
// Error handler utility
function handleError(error: any, res: Response, userMessage: string = 'An error occurred') {
  console.error('Error:', error) // Log full error server-side
  
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      message: userMessage,
      error: error.message,
      stack: error.stack
    })
  }
  
  // Production: generic message only
  return res.status(500).json({
    success: false,
    message: userMessage,
    errorCode: 'INTERNAL_ERROR'
  })
}
```

#### 8. **Missing Rate Limiting**
**Location:** All API endpoints
**Severity:** MEDIUM
**Description:** No rate limiting implemented on any endpoint, allowing brute force and DoS attacks.

**Impact:**
- Brute force attacks on authentication
- DoS through resource exhaustion
- API cost overruns (if using third-party services)
- Credential stuffing attacks

**Recommendation:**
- Implement rate limiting per IP address
- Stricter limits on authentication endpoints
- Implement exponential backoff for failed attempts
- Add CAPTCHA for sensitive operations after threshold

**Fix:**
```typescript
import rateLimit from 'express-rate-limit'

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
})

// Stricter limiter for sensitive operations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 attempts per window
  message: 'Too many authentication attempts'
})

app.use('/api/', apiLimiter)
app.use('/api/ifood/config', authLimiter)
```

#### 9. **No Request Size Limits**
**Location:** `backend/src/server.ts:37`
**Severity:** MEDIUM
**Description:** Express JSON and URL-encoded parsers have no size limits configured.

```typescript
app.use(express.json()) // No limit!
app.use(express.urlencoded({ extended: true })) // No limit!
```

**Impact:**
- DoS through large payloads
- Memory exhaustion
- Server crashes

**Recommendation:**
- Add reasonable size limits
- Reject oversized requests early
- Configure limits based on legitimate use cases

**Fix:**
```typescript
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
```

#### 10. **Webhook Endpoint Lacks HMAC Verification**
**Location:** `backend/src/routes/ifood.ts:741` (POST `/webhook`)
**Severity:** MEDIUM
**Description:** The webhook endpoint accepts any POST request without verifying it came from iFood. This allows webhook spoofing attacks.

```typescript
router.post('/webhook', async (req, res) => {
  const webhookData = req.body
  // No signature verification!
  // Anyone can send fake webhooks
})
```

**Impact:**
- Attackers can inject fake orders
- Unauthorized status updates
- Business logic manipulation
- Data corruption

**Recommendation:**
- Implement HMAC signature verification for webhooks
- Follow iFood's webhook security documentation
- Validate webhook structure before processing
- Add webhook source IP whitelisting if possible

**Fix:**
```typescript
import crypto from 'crypto'

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-ifood-signature'] as string
  const webhookSecret = process.env.IFOOD_WEBHOOK_SECRET
  
  if (!signature || !webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const payload = JSON.stringify(req.body)
  if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  
  // Process webhook
})
```

### 🔵 LOW/INFORMATIONAL

#### 11. **Sensitive Data in Console Logs**
**Location:** Multiple locations
**Severity:** LOW
**Description:** Sensitive information is logged to console throughout the application.

**Examples:**
- Access tokens in authentication logs
- Customer personal information
- API keys and secrets (masked, but still present)

**Recommendation:**
- Use a structured logging library (e.g., Winston, Pino)
- Implement log levels and redact sensitive data
- Don't log sensitive data in production
- Use secure log aggregation services

#### 12. **Missing Security Headers**
**Location:** `backend/src/server.ts`
**Severity:** LOW
**Description:** No security headers configured (CSP, HSTS, X-Frame-Options, etc.)

**Recommendation:**
- Use `helmet` middleware
- Configure Content-Security-Policy
- Enable HSTS for HTTPS
- Set X-Frame-Options to prevent clickjacking

**Fix:**
```typescript
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))
```

#### 13. **No API Versioning**
**Location:** API endpoints
**Severity:** LOW
**Description:** API lacks versioning strategy, making breaking changes difficult to manage.

**Recommendation:**
- Implement API versioning (e.g., `/api/v1/ifood/...`)
- Document API contract
- Use semantic versioning for API versions

## Compliance & Best Practices

### Data Privacy (LGPD/GDPR)
⚠️ **Customer Data Handling:**
- Customer PII (names, addresses, phone numbers) is stored without documented consent mechanism
- No data retention policy implemented
- No data anonymization for analytics
- Missing data access/deletion endpoints for customer rights

**Recommendations:**
- Implement consent management
- Add data retention/deletion policies
- Anonymize or pseudonymize data for analytics
- Provide API endpoints for data subject rights (access, deletion, portability)

### PCI DSS (Payment Data)
✅ **Good:** Payment data is handled by iFood, not stored locally
⚠️ **Concern:** Payment method information is stored in orders table

**Recommendations:**
- Verify no sensitive card data is ever stored
- Document payment flow clearly
- Implement logging for payment operations

## Security Testing Recommendations

1. **Immediate Actions:**
   - Fix critical vulnerabilities (#1, #2, #3)
   - Rotate all credentials
   - Add authentication middleware
   - Configure .gitignore properly

2. **Short Term (1-2 weeks):**
   - Implement input validation
   - Add rate limiting
   - Fix CORS configuration
   - Add security headers
   - Implement webhook verification

3. **Long Term (1-3 months):**
   - Set up penetration testing
   - Implement security monitoring (SIEM)
   - Add automated security scanning to CI/CD
   - Conduct security training for developers
   - Implement comprehensive audit logging

4. **Ongoing:**
   - Regular dependency updates
   - Security patch management
   - Periodic security audits
   - Code review with security focus

## Automated Security Tools Recommended

1. **SAST (Static Application Security Testing):**
   - Snyk Code
   - SonarQube
   - ESLint with security plugins

2. **Dependency Scanning:**
   - Dependabot (GitHub)
   - Snyk
   - npm audit

3. **DAST (Dynamic Application Security Testing):**
   - OWASP ZAP
   - Burp Suite

4. **Secret Scanning:**
   - TruffleHog
   - git-secrets
   - GitHub Secret Scanning

## Conclusion

This security review identified **13 vulnerabilities** across the iFood integration:
- **2 Critical** (must fix immediately)
- **8 High/Medium** (fix within 1-2 weeks)
- **3 Low/Informational** (improve over time)

The most critical issues are:
1. Weak default encryption key
2. Missing authentication/authorization
3. Secrets potentially committed to git

**Overall Risk Assessment:** **HIGH**

Without immediate fixes to critical vulnerabilities, the application poses significant security risks including:
- Data breaches
- Unauthorized access
- Business disruption
- Compliance violations

---

**Next Steps:**
1. Review and prioritize findings with development team
2. Create tickets for each vulnerability
3. Implement fixes in order of priority
4. Re-test after fixes
5. Implement continuous security monitoring

**Report prepared by:** GitHub Copilot Security Review  
**Contact:** @copilot in PR comments
