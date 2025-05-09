const { core } = require("photoshop");
//////////////////////////////////////
////////////UTILITIES/////////////
//////////////////////////////////////
//Per this thread: https://forums.creativeclouddeveloper.com/t/clicking-any-button-on-any-uxp-panel-inactivates-keyboard-shortcuts-for-tools-and-brush-sizes/2379/11 
//This stupid workaround is needed to ensure keyboard shortcuts work after any action is run. Fuck you adobe!
function restoreFocus() {
    //get OS platform 
    const os = require('os').platform();
    if (os.includes('win')) {
        //for PC
        core.performMenuCommand({
            commandID: 1208,
            kcanDispatchWhileModal: true,
            _isCommand: false
        });
    } else {
        //for Mac
        const cmds = [2982,2986,2986];
        cmds.map(cmd => core.performMenuCommand({
            commandID: cmd,
            kcanDispatchWhileModal: true,
            _isCommand: false
        }));
    }
}  

function getEl(selector) {
    return document.querySelector(selector);
}

function getEls(selector) {
    return document.querySelectorAll(selector);
}  

function proxyArraysEqual(a, b) {
    // 1) If they’re literally the same object, they’re equal
    if (a === b) return true;
  
    // 2) Both must be array-like and same length
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }
  
    // 3) Compare each entry to check doc and layer ids match
    return a.every((elementA, i) => elementA._docId === b[i]._docId && elementA._id === b[i]._id);
}

export {
    getEl,
    getEls,
    restoreFocus,
    proxyArraysEqual
};