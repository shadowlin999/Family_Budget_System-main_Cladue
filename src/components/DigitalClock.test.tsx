// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DigitalClock } from './DigitalClock';

// Pin time to 2024-06-15 08:30:45 UTC so timezone math is deterministic
const FIXED_UTC_MS = new Date('2024-06-15T08:30:45.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_UTC_MS);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DigitalClock', () => {
  it('renders time in HH:MM:SS format for UTC+8 (offset=480)', () => {
    render(<DigitalClock timezoneOffset={480} />);
    // 08:30:45 UTC + 8h = 16:30:45 local
    expect(screen.getByText('16:30:45')).toBeInTheDocument();
  });

  it('renders date in yyyy/mm/dd format', () => {
    render(<DigitalClock timezoneOffset={480} />);
    expect(screen.getByText('2024/06/15')).toBeInTheDocument();
  });

  it('applies negative timezone offset correctly (UTC-5, offset=-300)', () => {
    render(<DigitalClock timezoneOffset={-300} />);
    // 08:30:45 UTC - 5h = 03:30:45
    expect(screen.getByText('03:30:45')).toBeInTheDocument();
  });

  it('shows timezone label (UTC+8)', () => {
    render(<DigitalClock timezoneOffset={480} />);
    expect(screen.getByText('UTC+8')).toBeInTheDocument();
  });

  it('shows ChevronDown icon when onChangeTimezone is provided', () => {
    const { container } = render(
      <DigitalClock timezoneOffset={480} onChangeTimezone={vi.fn()} />
    );
    // lucide renders an svg — just check it exists
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(1); // Clock icon + ChevronDown
  });

  it('does NOT show timezone picker by default', () => {
    render(<DigitalClock timezoneOffset={480} onChangeTimezone={vi.fn()} />);
    expect(screen.queryByText('選擇時區')).not.toBeInTheDocument();
  });

  it('shows timezone picker when clock is clicked (with onChangeTimezone)', () => {
    render(<DigitalClock timezoneOffset={480} onChangeTimezone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('選擇時區')).toBeInTheDocument();
  });

  it('does NOT open picker on click when onChangeTimezone is absent', () => {
    render(<DigitalClock timezoneOffset={480} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('選擇時區')).not.toBeInTheDocument();
  });

  it('calls onChangeTimezone when a timezone option is selected', () => {
    const handler = vi.fn();
    render(<DigitalClock timezoneOffset={480} onChangeTimezone={handler} />);
    // Open picker
    fireEvent.click(screen.getByRole('button'));
    // The picker lists timezone labels; pick UTC+9 (different from current) to avoid clock button ambiguity
    const jpButton = screen.getByText('日本/韓國 (UTC+9)');
    fireEvent.click(jpButton);
    expect(handler).toHaveBeenCalledWith(540);
  });

  it('closes picker after selecting a timezone', () => {
    render(<DigitalClock timezoneOffset={480} onChangeTimezone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('日本/韓國 (UTC+9)'));
    expect(screen.queryByText('選擇時區')).not.toBeInTheDocument();
  });
});
