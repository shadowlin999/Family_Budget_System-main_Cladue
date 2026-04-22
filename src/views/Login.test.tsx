// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { User } from '../store/index';

// ─── Mock Firebase ────────────────────────────────────────────────────────────
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/firebase', () => ({
  auth: {},
  googleProvider: {},
}));

// ─── Store mock factory ───────────────────────────────────────────────────────
const mockLogin = vi.fn();
const mockLogout = vi.fn();

const makeStore = (overrides: Partial<ReturnType<typeof defaultStore>> = {}) => ({
  ...defaultStore(),
  ...overrides,
});

function defaultStore() {
  return {
    firebaseUser: null as null | { uid: string; email: string },
    familyId: null as null | string,
    familyName: null as null | string,
    users: [] as User[],
    login: mockLogin,
    logout: mockLogout,
    isLoading: false,
  };
}

vi.mock('../store/index', () => ({
  useStore: vi.fn(),
}));

// Lazily import Login AFTER mocks are set up
import Login from './Login';
import { useStore } from '../store/index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseStore = useStore as any;

// ─── Shared parent/kid fixtures ───────────────────────────────────────────────
const parent: User = {
  id: 'p1', name: '爸爸', role: 'primary_admin', level: 1, exp: 0,
  googleUid: 'google-uid-123',
};
const kid: User = {
  id: 'k1', name: '小明', role: 'kid', level: 3, exp: 250, gems: 10,
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Login — not signed in (no firebaseUser)', () => {
  beforeEach(() => {
    mockUseStore.mockReturnValue(makeStore({ firebaseUser: null }));
  });

  it('shows the app title', () => {
    render(<Login />);
    expect(screen.getByText('家庭預算系統')).toBeInTheDocument();
  });

  it('shows Google sign-in button', () => {
    render(<Login />);
    expect(screen.getByText('使用 Google 帳號登入')).toBeInTheDocument();
  });

  it('sign-in button is enabled by default', () => {
    render(<Login />);
    const btn = screen.getByText('使用 Google 帳號登入');
    expect(btn.closest('button')).not.toBeDisabled();
  });

  it('shows spinner and disables button while loading', () => {
    mockUseStore.mockReturnValue(makeStore({ firebaseUser: null, isLoading: true }));
    render(<Login />);
    expect(screen.getByText('正在登入...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls signInWithPopup when Google button is clicked', async () => {
    const { signInWithPopup } = await import('firebase/auth');
    render(<Login />);
    fireEvent.click(screen.getByText('使用 Google 帳號登入'));
    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
  });
});

describe('Login — signed in, family found (user selection screen)', () => {
  beforeEach(() => {
    mockUseStore.mockReturnValue(makeStore({
      firebaseUser: { uid: 'google-uid-123', email: 'dad@example.com' },
      familyId: 'fam1',
      familyName: '快樂家庭',
      users: [parent, kid],
    }));
  });

  it('shows the welcome heading', () => {
    render(<Login />);
    expect(screen.getByText('歡迎回來！你是誰呢？')).toBeInTheDocument();
  });

  it('shows family name', () => {
    render(<Login />);
    expect(screen.getByText('快樂家庭')).toBeInTheDocument();
  });

  it('lists parent user', () => {
    render(<Login />);
    expect(screen.getByText('爸爸')).toBeInTheDocument();
  });

  it('lists kid user', () => {
    render(<Login />);
    expect(screen.getByText('小明')).toBeInTheDocument();
  });

  it('shows kid level badge', () => {
    render(<Login />);
    expect(screen.getByText('Lv.3')).toBeInTheDocument();
  });

  it('shows "目前帳號" badge next to matched Google UID', () => {
    render(<Login />);
    expect(screen.getByText('目前帳號')).toBeInTheDocument();
  });

  it('shows logout link at the bottom', () => {
    render(<Login />);
    expect(screen.getByText('切換其他 Google 帳號')).toBeInTheDocument();
  });

  it('calls logout when logout link is clicked', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('切換其他 Google 帳號'));
    expect(mockLogout).toHaveBeenCalled();
  });
});

describe('Login — PIN verification screen', () => {
  beforeEach(() => {
    mockUseStore.mockReturnValue(makeStore({
      firebaseUser: { uid: 'google-uid-123', email: 'dad@example.com' },
      familyId: 'fam1',
      familyName: '快樂家庭',
      users: [parent, kid],
    }));
  });

  it('shows PIN screen after clicking a profile', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('爸爸'));
    expect(screen.getByText('請輸入您的 4 位數認證碼')).toBeInTheDocument();
  });

  it('shows back button on PIN screen', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('爸爸'));
    expect(screen.getByText('← 返回')).toBeInTheDocument();
  });

  it('back button returns to profile selection', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('爸爸'));
    fireEvent.click(screen.getByText('← 返回'));
    expect(screen.getByText('歡迎回來！你是誰呢？')).toBeInTheDocument();
  });

  it('confirm button is disabled until 4 digits entered', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('爸爸'));
    const confirmBtn = screen.getByText('確認');
    expect(confirmBtn.closest('button')).toBeDisabled();
  });

  it('calls login with correct userId when correct PIN entered (default 0000)', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('爸爸'));
    // Type 0, 0, 0, 0
    const zeroBtn = screen.getAllByText('0').find(el => el.closest('button'));
    for (let i = 0; i < 4; i++) fireEvent.click(zeroBtn!.closest('button')!);
    fireEvent.click(screen.getByText('確認'));
    expect(mockLogin).toHaveBeenCalledWith('p1');
  });

  it('shows error message for wrong PIN', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('爸爸'));
    // Type 1, 2, 3, 4 (wrong)
    ['1', '2', '3', '4'].forEach(n => {
      fireEvent.click(screen.getByText(n));
    });
    fireEvent.click(screen.getByText('確認'));
    expect(screen.getByText(/PIN 碼錯誤/)).toBeInTheDocument();
  });

  it('重設 clears PIN input', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('爸爸'));
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('重設'));
    const confirmBtn = screen.getByText('確認');
    expect(confirmBtn.closest('button')).toBeDisabled(); // back to 0 digits
  });
});

describe('Login — loading state (firebase user but no family yet)', () => {
  it('shows spinner while family data is loading', () => {
    mockUseStore.mockReturnValue(makeStore({
      firebaseUser: { uid: 'google-uid-123', email: 'dad@example.com' },
      familyId: null,
      isLoading: false,
    }));
    render(<Login />);
    // Shows spinner (no familyId and no null firebaseUser)
    const { container } = render(<Login />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
