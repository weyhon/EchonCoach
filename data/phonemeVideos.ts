// Maps IPA phoneme symbols to YouTube video IDs (Rachel's English series).
// Used by WordDetailModal to show inline pronunciation video for score < 80 phonemes.
// To update: replace the video ID string with any YouTube video ID that demonstrates the phoneme.
export const PHONEME_VIDEOS: Record<string, string> = {
  // ─── Vowels ───
  'iː': 'scCesnn-0XY',  // FLEECE — Long E
  'ɪ':  '-km81q6DIlM',  // KIT — Short I
  'e':  'xKxV8XfigaE',  // DRESS — Short E
  'æ':  '-i7-DDAW-ok',  // TRAP — Short A
  'ɑː': 'DEJGBC4xZzI',  // START — Ah vowel
  'ɒ':  'A3l-yWQfIW4',  // LOT — Short O (British)
  'ɔː': 'Bc1tCtP2ZSg',  // THOUGHT — Long AW sound
  'ʊ':  'phlnzlzCPqE',  // FOOT — Short OO
  'uː': 'IwahymIkGJ0',  // GOOSE — Long OO
  'ʌ':  '_63fTgbG-yQ',  // STRUT — Short U
  'ɜː': 'Ehn6XixUBKs',  // NURSE — ER sound
  'ə':  '2BmkUa4Mv60',  // schwa
  // ─── Diphthongs ───
  'eɪ': 'XOuD6mFr6sQ',  // FACE
  'aɪ': 'rbQtAWNFy2I',  // PRICE
  'ɔɪ': '3cdSvIuTxLY',  // CHOICE
  'əʊ': 'Civ7UBZP99M',  // GOAT (British)
  'oʊ': 'Civ7UBZP99M',  // GOAT (American)
  'aʊ': 'i8KThVR713Q',  // MOUTH
  'ɪə': 'ftwSXO8Fsjk',  // NEAR — Ear sound
  'eə': '0J7-5maJJIk',  // SQUARE — Air sound
  'ʊə': 'nHSqluHrD-U',  // CURE — Pure sound
  // ─── Consonants: plosives ───
  'p':  'JPUr5MgeDHM',
  'b':  'JPUr5MgeDHM',  // voiced/voiceless pair
  't':  'hGZ9GwrNWmU',
  'd':  'hGZ9GwrNWmU',
  'k':  'O_NisgL1dvY',
  'ɡ':  'O_NisgL1dvY',  // IPA g
  'g':  'O_NisgL1dvY',  // ASCII g variant
  // ─── Consonants: fricatives ───
  'f':  'nR-K3mrHFv0',
  'v':  'nR-K3mrHFv0',
  'θ':  'nlKNo1TGALA',  // TH (thin)
  'ð':  'nlKNo1TGALA',  // TH (this)
  's':  'xl-7mSeybmI',
  'z':  'xl-7mSeybmI',
  'ʃ':  'RxaLKZPPEvY',  // SH
  'ʒ':  'RxaLKZPPEvY',  // ZH (measure)
  'h':  'uOG-4ZjR7ic',
  // ─── Consonants: affricates ───
  'tʃ': 'aqHebuRjO0k',  // CH
  'dʒ': 'aqHebuRjO0k',  // J
  // ─── Consonants: nasals ───
  'm':  'CoEh8cz-mS4',
  'n':  'HeMzjC672OA',
  'ŋ':  '6ESY7ueSfrc',  // NG
  // ─── Consonants: approximants ───
  'l':  'FP0jHNoFqWo',
  'r':  'G_OQjKLvt0E',
  'j':  '1Yo4BHIIBP8',  // Y sound
  'w':  'RW94L6606DE',
}
