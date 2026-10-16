const { Key } = require('@nut-tree-fork/nut-js');

// KeyboardEvent.code (tecla física) -> nombre en el enum Key de nut-js
const names = {
  Escape: 'Escape', Tab: 'Tab', CapsLock: 'CapsLock', Space: 'Space', Enter: 'Enter',
  Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
  ShiftLeft: 'LeftShift', ShiftRight: 'RightShift',
  ControlLeft: 'LeftControl', ControlRight: 'RightControl',
  AltLeft: 'LeftAlt', AltRight: 'RightAlt',
  MetaLeft: 'LeftSuper', MetaRight: 'RightSuper', ContextMenu: 'Menu',
  Minus: 'Minus', Equal: 'Equal', BracketLeft: 'LeftBracket', BracketRight: 'RightBracket',
  Backslash: 'Backslash', Semicolon: 'Semicolon', Quote: 'Quote', Comma: 'Comma',
  Period: 'Period', Slash: 'Slash', Backquote: 'Grave',
  PrintScreen: 'Print', ScrollLock: 'ScrollLock', Pause: 'Pause', NumLock: 'NumLock',
  NumpadAdd: 'Add', NumpadSubtract: 'Subtract', NumpadMultiply: 'Multiply',
  NumpadDivide: 'Divide', NumpadDecimal: 'Decimal', NumpadEnter: 'Enter',
};

for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i);
  names['Key' + letter] = letter;
}
for (let i = 0; i <= 9; i++) {
  names['Digit' + i] = 'Num' + i;
  names['Numpad' + i] = 'NumPad' + i;
}
for (let i = 1; i <= 24; i++) names['F' + i] = 'F' + i;

const keymap = new Map();
for (const [code, name] of Object.entries(names)) {
  if (Key[name] !== undefined) keymap.set(code, Key[name]);
}

module.exports = keymap;
