import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WordPopover } from './WordPopover';

const base = {
  word: 'going',
  left: 100,
  top: 50,
  placement: 'above' as const,
  onReplay: vi.fn(),
  onClose: vi.fn(),
};

describe('WordPopover', () => {
  it('shows loading placeholder while definition is null', () => {
    render(<WordPopover {...base} definition={null} error={false} />);
    expect(screen.getByText('LOOKING UP…')).toBeTruthy();
  });

  it('shows word, ipa and meaning when loaded', () => {
    render(
      <WordPopover
        {...base}
        definition={{ ipa: '/ˈgoʊɪŋ/', meaning: '（近况）进展' }}
        error={false}
      />
    );
    expect(screen.getByText('going')).toBeTruthy();
    expect(screen.getByText('/ˈgoʊɪŋ/')).toBeTruthy();
    expect(screen.getByText('（近况）进展')).toBeTruthy();
  });

  it('shows failure label on error', () => {
    render(<WordPopover {...base} definition={null} error={true} />);
    expect(screen.getByText('LOOKUP FAILED')).toBeTruthy();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<WordPopover {...base} definition={null} error={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onReplay when replay button is clicked', () => {
    const onReplay = vi.fn();
    render(
      <WordPopover
        {...base}
        definition={{ ipa: '/ˈgoʊɪŋ/', meaning: '进展' }}
        error={false}
        onReplay={onReplay}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /replay/i }));
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
