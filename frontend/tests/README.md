# VPS Panel Frontend - Test Suite

Infrastruttura di testing completa per il VPS Panel Frontend usando Vitest e React Testing Library.

## Setup

### Dipendenze
```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D jsdom @vitejs/plugin-react
```

### Scripts Disponibili
```bash
npm run test          # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Run tests with UI dashboard
npm run test:coverage # Run tests with coverage report
```

## Struttura

```
tests/
├── setup.ts                     # Setup globale e mocks
├── components/
│   └── ui/
│       └── button.test.tsx      # Test componenti UI
├── store/
│   └── authStore.test.ts        # Test Zustand stores
├── hooks/
│   └── useAuth.test.tsx         # Test custom hooks
└── lib/
    └── utils.test.ts            # Test utility functions
```

## Configurazione

### vitest.config.ts
- Ambiente: jsdom (per DOM testing)
- Setup files: tests/setup.ts
- Coverage: v8 provider
- Thresholds: 80% (lines, functions, branches, statements)
- Exclude: e2e/, .next/, node_modules/

### tests/setup.ts
Mocks globali:
- next/navigation (useRouter, usePathname, etc.)
- next-themes (useTheme, ThemeProvider)
- window.matchMedia
- IntersectionObserver

## Best Practices

### Test Naming
```typescript
describe('Component Name', () => {
  it('should [expected behavior] when [condition]', () => {
    // Test implementation
  })
})
```

### Component Testing
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('calls onClick when clicked', async () => {
  const handleClick = vi.fn()
  const user = userEvent.setup()
  
  render(<Button onClick={handleClick}>Click</Button>)
  await user.click(screen.getByRole('button'))
  
  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

### Store Testing
```typescript
import { useAuthStore } from '@/store/authStore'

beforeEach(() => {
  useAuthStore.setState({ /* reset state */ })
  vi.clearAllMocks()
})

it('updates state correctly', async () => {
  const { login } = useAuthStore.getState()
  await login('email', 'password')
  
  const state = useAuthStore.getState()
  expect(state.isAuthenticated).toBe(true)
})
```

### Hook Testing
```typescript
import { renderHook, waitFor } from '@testing-library/react'

it('fetches data on mount', async () => {
  const { result } = renderHook(() => useCustomHook())
  
  await waitFor(() => {
    expect(result.current.data).toBeDefined()
  })
})
```

## Coverage Goals

| File Type | Target | Current |
|-----------|--------|---------|
| Components | 80%+ | 100% (button.tsx) |
| Stores | 80%+ | 100% (authStore.ts) |
| Hooks | 80%+ | 100% (useAuth.ts) |
| Utils | 80%+ | 100% (utils.ts) |
| **Overall** | **80%+** | **36%** (in progress) |

## Next Steps

1. Aggiungere test per altri componenti UI critici:
   - tests/components/layout/Sidebar.test.tsx
   - tests/components/layout/Header.test.tsx
   - tests/components/settings/*.test.tsx

2. Completare test stores:
   - tests/store/projectsStore.test.ts
   - tests/store/containersStore.test.ts
   - tests/store/monitoringStore.test.ts

3. Test custom hooks:
   - tests/hooks/useAsyncAction.test.ts
   - tests/hooks/useMediaQuery.test.ts
   - tests/hooks/useProjectsWebSocket.test.ts

4. Integration tests:
   - tests/integration/auth-flow.test.tsx
   - tests/integration/project-crud.test.tsx

## CI/CD Integration

Il coverage report viene generato automaticamente in CI:
- Test passano: ✅ merge consentito
- Coverage < 80%: ⚠️ warning (non blocca)
- Test fail: ❌ merge bloccato

## Risorse

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
