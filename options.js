var tcDefaults = {

  toggleKeyCode: 84,
  debugKeyCode: 68,
  skipTime: 10,
  blacklist: `
    www.instagram.com
    twitter.com
    vine.co
    imgur.com
  `.replace(/^\s+|\s+$/gm,'')
};

var keyCodeAliases = {
  32:  'Space',
  96:  'Num 0',
  97:  'Num 1',
  98:  'Num 2',
  99:  'Num 3',
  100: 'Num 4',
  101: 'Num 5',
  102: 'Num 6',
  103: 'Num 7',
  104: 'Num 8',
  105: 'Num 9',
  106: 'Num *',
  107: 'Num +',
  109: 'Num -',
  110: 'Num .',
  111: 'Num /',
  186: ';',
  188: '<',
  189: '-',
  187: '+',
  190: '>',
  191: '/',
  192: '~',
  219: '[',
  220: '\\',
  221: ']',
  222: '\'',
}

function recordKeyPress(e) {
  if (
    (e.keyCode >= 48 && e.keyCode <= 57)    // Numbers 0-9
    || (e.keyCode >= 65 && e.keyCode <= 90) // Letters A-Z
    || keyCodeAliases[e.keyCode]            // Other character keys
  ) {
    e.target.value = keyCodeAliases[e.keyCode] || String.fromCharCode(e.keyCode);
    e.target.keyCode = e.keyCode;

    e.preventDefault();
    e.stopPropagation();
  } else if (e.keyCode === 8) { // Clear input when backspace pressed
    e.target.value = '';
  }
};

function inputFilterNumbersOnly(e) {
  var char = String.fromCharCode(e.keyCode);
  if (!/[\d\.]$/.test(char) || !/^\d+(\.\d*)?$/.test(e.target.value + char)) {
    e.preventDefault();
    e.stopPropagation();
  }
};

function inputFocus(e) {
   e.target.value = "";
};

function inputBlur(e) {
  e.target.value = keyCodeAliases[e.target.keyCode] || String.fromCharCode(e.target.keyCode);
};

function updateShortcutInputText(inputId, keyCode) {
  document.getElementById(inputId).value = keyCodeAliases[keyCode] || String.fromCharCode(keyCode);
  document.getElementById(inputId).keyCode = keyCode;
}

// Saves options to chrome.storage
function save_options() {
  var toggleKeyCode = document.getElementById('toggleKeyInput').keyCode;
  var debugKeyCode = document.getElementById('debugKeyInput').keyCode;
  var skipTime = document.getElementById('skipTime').value;
  var blacklist     = document.getElementById('blacklist').value;


  toggleKeyCode = isNaN(toggleKeyCode) ? tcDefaults.toggleKeyCode : toggleKeyCode;
  skipTime = isNaN(skipTime) ? tcDefaults.skipTime : skipTime;
  debugKeyCode = isNaN(debugKeyCode) ? tcDefaults.debugKeyCode : debugKeyCode;

  chrome.storage.sync.set({

    toggleKeyCode: toggleKeyCode,
    debugKeyCode: debugKeyCode,
    skipTime : skipTime,
    blacklist:      blacklist.replace(/^\s+|\s+$/gm,'')
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved';
    setTimeout(function() {
      status.textContent = '';
    }, 1000);
  });
}

// Restores options from chrome.storage
function restore_options() {
  chrome.storage.sync.get(tcDefaults, function(storage) {
    updateShortcutInputText('toggleKeyInput', storage.toggleKeyCode);
    updateShortcutInputText('debugKeyInput', storage.debugKeyCode);
    document.getElementById('skipTime').value = storage.skipTime;
    document.getElementById('blacklist').value = storage.blacklist;
  });
}

function restore_defaults() {
  chrome.storage.sync.set(tcDefaults, function() {
    restore_options();
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Default options restored';
    setTimeout(function() {
      status.textContent = '';
    }, 1000);
  });
}

function initShortcutInput(inputId) {
  document.getElementById(inputId).addEventListener('focus', inputFocus);
  document.getElementById(inputId).addEventListener('blur', inputBlur);
  document.getElementById(inputId).addEventListener('keydown', recordKeyPress);
}

document.addEventListener('DOMContentLoaded', function () {
  restore_options();

  document.getElementById('save').addEventListener('click', save_options);
  document.getElementById('restore').addEventListener('click', restore_defaults);

  initShortcutInput('toggleKeyInput');
  initShortcutInput('debugKeyInput');

  document.getElementById('skipTime').addEventListener('keypress', inputFilterNumbersOnly);
})
