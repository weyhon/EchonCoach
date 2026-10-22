import { describe, it, expect } from 'vitest';
import { wordToPhoneticBlock, blockRangeForWords } from './ipaAlign';

describe('wordToPhoneticBlock', () => {
  it('maps each word to the IPA block it is pronounced in — linked words share a block', () => {
    expect(wordToPhoneticBlock('Do you like it?', 'Do you like‿it?', 'du ju ˈlaɪ.kɪt')).toEqual([0, 1, 2, 2]);
  });

  it('handles a chain of linked words and stripped commas', () => {
    expect(
      wordToPhoneticBlock(
        'What are your plans for the afternoon?',
        'What‿are your plans for‿the‿afternoon?',
        'ˈwʌ.ɾər jər ˈplænz fər.ði.æftərˈnun',
      ),
    ).toEqual([0, 0, 1, 2, 3, 3, 3]);
  });

  it('works out an ambiguous "‿ " (link mark before a space) by trying both readings', () => {
    // "Just‿ tap" is two blocks in the IPA, "or‿ pay" is one.
    expect(
      wordToPhoneticBlock(
        'Just tap your phone or pay the driver in cash',
        'Just‿ tap your phone or‿ pay the‿driver‿in cash',
        'ˈdʒʌst ˈtæp jər ˈfoʊn ɔr.ˈpeɪ ðə.ˈdraɪ.vər.ɪn ˈkæʃ',
      ),
    ).toEqual([0, 1, 2, 3, 4, 4, 5, 5, 5, 6]);
  });

  it('returns null when the block counts cannot be reconciled — never guesses', () => {
    expect(wordToPhoneticBlock('Do you like it?', 'Do you like it?', 'du ju ˈlaɪ.kɪt')).toBeNull();
  });

  it('returns null when the linked sentence has different words from the script', () => {
    expect(wordToPhoneticBlock('Do you like it?', 'Do you love‿it?', 'du ju ˈlʌ.vɪt')).toBeNull();
  });

  it('returns null for missing data', () => {
    expect(wordToPhoneticBlock('Hi there', undefined, 'haɪ ðɛr')).toBeNull();
    expect(wordToPhoneticBlock('Hi there', 'Hi there', '')).toBeNull();
  });
});

describe('blockRangeForWords', () => {
  const map = [0, 1, 2, 2, 3];
  it('covers every block the selected words touch', () => {
    expect(blockRangeForWords(map, 1, 3)).toEqual([1, 2]);
    expect(blockRangeForWords(map, 3, 3)).toEqual([2, 2]);
  });
  it('is null without a map or with an out-of-range selection', () => {
    expect(blockRangeForWords(null, 0, 0)).toBeNull();
    expect(blockRangeForWords(map, 4, 9)).toBeNull();
  });
});
