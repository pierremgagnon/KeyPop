// keyboards.js — dispositions AZERTY, codage couleur par doigt, détection OS.

export const FINGER_COLORS = {
  pL: '#FFD3DE', rL: '#FFE3C0', mL: '#FFF1B8', iL: '#D2EFBC',
  iR: '#BCEEDF', mR: '#BFE2FF', rR: '#D7D4FF', pR: '#ECD2FF', th: '#E7E7EF'
};

export const FINGER_LABELS = {
  pL: 'Auriculaire G', rL: 'Annulaire G', mL: 'Majeur G', iL: 'Index G',
  iR: 'Index D', mR: 'Majeur D', rR: 'Annulaire D', pR: 'Auriculaire D', th: 'Pouce'
};

// Une touche : { main, sub, finger, w, char }
// `char` = caractère produit (base, sans Maj) servant à associer la frappe à la touche.
const k = (main, finger, opts = {}) => ({
  main, sub: opts.sub || '', finger, w: opts.w || 1,
  faded: !!opts.faded, bump: !!opts.bump,
  char: opts.char !== undefined ? opts.char : (main.length === 1 ? main.toLowerCase() : null)
});

// Bloc principal AZERTY : les lettres et la ponctuation ne changent pas d'une disposition à
// l'autre (le programme d'apprentissage est construit dessus) — seule la rangée de touches de
// modification (Ctrl/Alt/Cmd) diffère visuellement entre PC et Mac.
const AZERTY_TOP4 = [
  [ k('²','pL',{char:'²'}), k('&','pL',{sub:'1',char:'&'}), k('é','rL',{sub:'2',char:'é'}), k('"','mL',{sub:'3',char:'"'}), k("'",'iL',{sub:'4',char:"'"}), k('(','iL',{sub:'5',char:'('}), k('-','iR',{sub:'6',char:'-'}), k('è','iR',{sub:'7',char:'è'}), k('_','mR',{sub:'8',char:'_'}), k('ç','rR',{sub:'9',char:'ç'}), k('à','pR',{sub:'0',char:'à'}), k(')','pR',{sub:'°',char:')'}), k('=','pR',{sub:'+',char:'='}), k('⌫','pR',{w:1.9,faded:true,char:null}) ],
  [ k('Tab','pL',{w:1.5,faded:true,char:null}), k('A','pL'), k('Z','rL'), k('E','mL'), k('R','iL'), k('T','iL'), k('Y','iR'), k('U','iR'), k('I','mR'), k('O','rR'), k('P','pR'), k('^','pR',{sub:'¨',char:null}), k('$','pR',{sub:'£',char:'$'}) ],
  [ k('⇪','pL',{w:1.75,faded:true,char:null}), k('Q','pL'), k('S','rL'), k('D','mL'), k('F','iL',{bump:true}), k('G','iL'), k('H','iR'), k('J','iR',{bump:true}), k('K','mR'), k('L','rR'), k('M','pR'), k('ù','pR',{sub:'%',char:'ù'}), k('*','pR',{sub:'µ',char:'*'}), k('Entrée','pR',{w:1.6,faded:true,char:'Enter'}) ],
  [ k('⇧','pL',{w:1.25,faded:true,char:null}), k('<','pL',{sub:'>',char:'<'}), k('W','pL'), k('X','rL'), k('C','mL'), k('V','iL'), k('B','iL'), k('N','iR'), k(',','iR',{sub:'?',char:','}), k(';','mR',{sub:'.',char:';'}), k(':','rR',{sub:'/',char:':'}), k('!','pR',{sub:'§',char:'!'}), k('⇧','pR',{w:1.95,faded:true,char:null}) ]
];

const MODIFIER_ROW_PC = [ k('Ctrl','pL',{w:1.4,faded:true,char:null}), k('⊞','pL',{w:1,faded:true,char:null}), k('Alt','pL',{w:1.1,faded:true,char:null}), k('espace','th',{w:6.4,char:' '}), k('AltGr','pR',{w:1.2,faded:true,char:null}), k('Ctrl','pR',{w:1.4,faded:true,char:null}) ];
const MODIFIER_ROW_MAC = [ k('⌃','pL',{w:1.4,faded:true,char:null}), k('⌥','pL',{w:1,faded:true,char:null}), k('⌘','pL',{w:1.1,faded:true,char:null}), k('espace','th',{w:6.4,char:' '}), k('⌘','pR',{w:1.1,faded:true,char:null}), k('⌥','pR',{w:1.2,faded:true,char:null}) ];

// Dispositions disponibles. Toutes partagent les mêmes lettres (AZERTY) — seule change la
// rangée de modificateurs, pour coller au clavier physique réel de l'élève.
export const LAYOUTS = {
  'azerty-pc': { label: 'AZERTY · PC', rows: [...AZERTY_TOP4, MODIFIER_ROW_PC] },
  'azerty-mac': { label: 'AZERTY · Mac', rows: [...AZERTY_TOP4, MODIFIER_ROW_MAC] }
};

export function layoutIdFor(os) { return os === 'mac' ? 'azerty-mac' : 'azerty-pc'; }
export function rowsForLayout(layoutId) { return (LAYOUTS[layoutId] || LAYOUTS['azerty-pc']).rows; }

// Rétrocompatibilité : disposition par défaut.
export const ROWS = LAYOUTS['azerty-pc'].rows;

// Map caractère -> touche (pour surligner la prochaine touche). Identique pour toutes les
// dispositions AZERTY puisque seules les touches non-imprimables (faded) diffèrent.
const CHAR_TO_KEY = {};
ROWS.forEach((row, ri) => row.forEach((key, ki) => {
  if (key.char && key.char.length === 1) CHAR_TO_KEY[key.char] = { ri, ki, finger: key.finger };
}));

export function keyInfoForChar(ch) {
  if (ch == null) return null;
  if (ch === ' ') return CHAR_TO_KEY[' '] || null;
  return CHAR_TO_KEY[ch] || CHAR_TO_KEY[ch.toLowerCase()] || null;
}

export function fingerForChar(ch) {
  const info = keyInfoForChar(ch);
  return info ? info.finger : null;
}

// Détecte la disposition physique réelle de l'OS.
export async function detectLayout() {
  let family = 'azerty';
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      const map = await navigator.keyboard.getLayoutMap();
      const q = map.get('KeyQ');           // AZERTY : la touche physique Q produit 'a'
      if (q === 'a') family = 'azerty';
      else if (q === 'q') family = 'qwerty';
      else if (q === 'q' && map.get('KeyY') === 'z') family = 'qwertz';
    } else if (/^fr/i.test(navigator.language || '')) {
      family = 'azerty';
    }
  } catch (e) { /* repli silencieux */ }
  const os = /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'pc';
  return { family, os };
}
