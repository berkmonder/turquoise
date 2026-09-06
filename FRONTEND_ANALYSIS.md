# Frontend Analysis — Turquoise Ecosystem

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.js (Root)                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  State: selectedModel, theme, isLoggedIn, showAuthModal    │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  Navbar                                                │  │  │
│  │  │  ┌──────────┐  ┌────────────────────┐  ┌──────────┐  │  │  │
│  │  │  │ TURQUOISE│  │ Sign In / Access   │  │ Theme    │  │  │  │
│  │  │  │ ECOSYSTEM│  │                     │  │ Toggle   │  │  │  │
│  │  │  └──────────┘  └────────────────────┘  └──────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  View Router                                         │  │  │
│  │  │  ┌──────────────────┐  ┌──────────────────────────┐  │  │  │
│  │  │  │ CatalogView       │  │ ModelDetailView          │  │  │  │
│  │  │  │ (Model Grid)      │  │ (Dual-panel)             │  │  │  │
│  │  │  └──────────────────┘  └──────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  Footer (Attribution: Turquoise Ecosystem Engine)      │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  AuthModal (Overlay)                                       │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │  Login Form                                            │  │  │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │  │
│  │  │  │  Email: [________________]                        │  │  │  │
│  │  │  │  Password: [________________]                     │  │  │  │
│  │  │  │  [Sign In]  [Don't have an account?]              │  │  │  │
│  │  │  └──────────────────────────────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── Navbar
│   ├── Brand (Turquoise + "ECOSYSTEM" badge)
│   └── Actions
│       ├── Login/Logout Button (toggle)
│       └── Theme Toggle (Dark/Light)
├── View Router
│   ├── CatalogView (default)
│   │   ├── ModelCard (repeated)
│   │   │   ├── Model Name
│   │   │   ├── Description
│   │   │   ├── Category Badge
│   │   │   ├── Execution Type Badge
│   │   │   └── "View Details" button
│   │   └── Filter Controls (category, execution_type)
│   └── ModelDetailView (when model selected)
│       ├── Model Info Panel
│       │   ├── Title & Description
│       │   ├── Owner & Category
│       │   ├── Execution Type & Input/Output Types
│       │   └── "Run Inference" button
│       └── Inference Panel
│           ├── Input Controls (text area, file upload, canvas)
│           ├── "Execute" button
│           └── Output Display (text, table, or image)
├── Footer (static attribution)
└── AuthModal (overlay, shown on login click)
    ├── Login Form
    │   ├── Email input
    │   ├── Password input
    │   └── Sign In button
    └── Developer Access Form (hidden by default)
        ├── Email input
        └── Submit button
```

## State Management Analysis

### Current State (App.js)

```javascript
const [selectedModel, setSelectedModel] = useState(null);
const [theme, setTheme] = useState('dark');
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [showAuthModal, setShowAuthModal] = useState(false);
```

| State | Location | Purpose | Issue |
|-------|----------|---------|-------|
| `selectedModel` | App.js | Tracks selected model | ✅ OK |
| `theme` | App.js | Dark/Light mode | ✅ OK |
| `isLoggedIn` | App.js | Login status | ❌ **Client-only** — lost on refresh |
| `showAuthModal` | App.js | Modal visibility | ✅ OK |

**Critical Gap:** No server-side session management. The "logged in" state is purely client-side and resets on every page refresh.

### State Flow

```
User clicks "Sign In" → setShowAuthModal(true)
    ↓
User enters credentials → POST /api/auth/verify
    ↓
Backend responds → setIsLoggedIn(true)
    ↓
UI shows "Developer Account (Logout)" pill
    ↓
User refreshes page → isLoggedIn = false ❌
```

**This is a fundamental architectural limitation.** The app has no way to persist authentication across sessions.

## API Integration Pattern

```javascript
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.API_BASE || '';

const fetchModels = async () => {
  try {
    setLoading(true);
    setError(null);
    const res = await fetch(`${API_BASE}/api/v1/models`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setModels(await res.json());
  } catch (err) {
    setError('Could not reach control plane. Ensure Docker stack is running.');
  } finally {
    setLoading(false);
  }
};
```

**Pattern Analysis:**

| Aspect | Status | Notes |
|--------|--------|-------|
| **Loading state** | ✅ | `setLoading(true)` before fetch |
| **Error handling** | ⚠️ | Single generic error message |
| **Retry logic** | ❌ | No retry, no backoff |
| **Request deduplication** | ❌ | Multiple clicks = multiple requests |
| **Offline detection** | ❌ | No `navigator.onLine` check |
| **Caching** | ❌ | No in-memory cache |
| **Polling** | ❌ | No polling for model updates |

### Inference Execution Pattern

```javascript
const runInference = async (modelId, payload) => {
  const res = await fetch(`${API_BASE}/api/v1/execute/${modelId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  // Display results...
};
```

**Issues:**
- No timeout handling
- No retry on network failure
- No streaming for LLM responses (the API supports SSE, but the UI doesn't consume it)

## UX/UI Analysis

### Design Decisions

| Feature | Implementation | Rationale |
|---------|---------------|-----------|
| **Dark/Light mode** | CSS class toggle | Simple, effective |
| **Model grid** | CSS Grid | Responsive, clean |
| **Dual-panel detail view** | Flexbox | Info on left, inference on right |
| **Theme toggle** | Pill button | Minimal UI |
| **Auth modal** | Overlay | Non-intrusive |

### Accessibility Analysis

| Criterion | Status | Notes |
|-----------|--------|-------|
| **ARIA labels** | ❌ None | Buttons have no `aria-label` |
| **Keyboard navigation** | ❌ None | No `tabIndex` management |
| **Focus management** | ❌ None | Modal doesn't trap focus |
| **Error announcements** | ❌ None | Screen readers get nothing |
| **Color contrast** | ✅ OK | Dark theme uses `#070a13` bg with `#ffffff` text |
| **Skip links** | ❌ None | No "skip to main content" |
| **Form labels** | ❌ None | Inputs have no associated labels |

**The app is essentially inaccessible to screen reader users.**

### Responsive Design

The app uses **flexbox and relative units** but has **no explicit breakpoints**. It relies on the viewport being wide enough for the dual-panel layout. On narrow screens, the panels will overflow.

**Recommended fix:** Add media queries that stack the panels on small screens.

## Bugs & Issues Identified

### Critical Bugs

1. **No authentication persistence** — Logged-in state resets on refresh. Users must re-login every time.
2. **No rate limiting on client** — Users can spam the API.
3. **No file upload validation** — Users can upload 1GB files that crash the browser.
4. **No input sanitization** — Users can inject HTML/JS into text fields.
5. **No offline handling** — No feedback when the network goes down.
6. **No loading skeleton** — The UI is blank while data loads.
7. **No error recovery** — One failed request breaks the entire app state.

### Medium-Priority Issues

8. **No debouncing** — Typing in the inference input fires requests on every keystroke.
9. **No input validation** — Empty text areas are accepted.
10. **No max file size** — No limit on uploaded files.
11. **No drag-and-drop** — File upload is a boring `<input type="file">`.
12. **No dark/light mode persistence** — The theme resets on refresh.
13. **No model filter** — Users can't filter models by category or execution type.
14. **No search** — No way to search model names.
15. **No pagination** — The model grid shows everything at once.

### Nice-to-Have

16. **No keyboard shortcuts** — No `?` help modal.
17. **No onboarding tour** — First-time users don't know what to do.
18. **No dark mode preference** — The theme is forced to dark by default.
19. **No model download button** — Users can't download ONNX files.
20. **No model sharing** — No way to share model cards.

## Component Reusability Assessment

| Component | Reusable? | Notes |
|-----------|-----------|-------|
| `Navbar` | ✅ Yes | Could be used in admin dashboard |
| `Footer` | ✅ Yes | Generic attribution footer |
| `CatalogView` | ❌ No | Tied to Turquoise-specific data |
| `ModelDetailView` | ❌ No | Tied to Turquoise-specific layout |
| `AuthModal` | ✅ Yes | Generic login modal pattern |
| `ThemeToggle` | ✅ Yes | Generic theme switcher |

**Observation:** The app is **not componentized**. Every view is a monolithic component that knows too much about its own layout and styling. This makes refactoring painful.

## Recommendations

### Immediate (v1.1)

1. **Add authentication persistence** — Use `localStorage` with a server-side session token (JWT).
2. **Add loading skeletons** — Show a skeleton while data loads.
3. **Add error recovery** — Show a "retry" button when an API call fails.
4. **Add debouncing** — Debounce inference requests by 500ms.
5. **Add input validation** — Show error messages for invalid inputs.
6. **Add file size limits** — Max 10MB for file uploads.

### Short-term (v1.2)

7. **Add search & filtering** — Search bar + category filters.
8. **Add pagination** — 20 models per page, page navigation.
9. **Add dark mode persistence** — `localStorage` for theme preference.
10. **Add offline detection** — Show "You're offline" message.
11. **Add drag-and-drop** — For file uploads.

### Long-term (v2.0)

12. **Refactor into a component library** — Extract reusable components.
13. **Add a storybook** — Document and test components.
14. **Add end-to-end tests** — Playwright/Cypress tests for critical flows.
15. **Add a11y improvements** — ARIA labels, keyboard navigation, focus management.

---

## Summary

The frontend is a **functional MVP** but is **not production-ready**. The core issues are:

1. **No server-side session management** — authentication is purely client-side.
2. **No error handling/recovery** — the app crashes on any API failure.
3. **No input validation** — users can send malformed requests.
4. **No loading states** — the UI is jarring while data loads.
5. **No accessibility** — the app is unusable for screen reader users.

The **architecture is sound** (component-based, state management via hooks), but the **implementation is naive**. The app works for a demo but would fail in production.

The fix is not a rewrite — it's **adding defensive layers** (validation, error handling, loading states, authentication persistence) around the existing architecture.
