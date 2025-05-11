const { core } = require("photoshop");
const {storage} = require('uxp');
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


async function loadManifest() {
    const pluginFolder = await storage.localFileSystem.getPluginFolder();
    const manifestFile = await pluginFolder.getEntry('manifest.json');
    const text = await manifestFile.read();
    return JSON.parse(text);
}

function parentGroupCount(layers) {
    return new Set(layers.map(l => l.parent?.id))
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

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}



/*overrides needed because sp-tag doesn't capture pointer events in the spaces between its border and its label text*/
/*and UXP doesn't support the psuedo selectors needed to pierce the shadow DOM on SWC components.*/
/*i hate this, but what can you do?*/
function setTagLabelCursor(elements, newCursorValue = 'pointer') {
    const tags = elements;
    tags.forEach(tag => {
        if (tag.shadowRoot) {
        const labelSpan = tag.shadowRoot.querySelector('span.label');
        if (labelSpan) {
            labelSpan.style.cursor = newCursorValue;
        } else {
            console.warn(`Could not find 'span.label' in sp-tag's shadowRoot for tag:`, tag);
        }
        } else {
        // Shadow DOM might not be ready yet, or it's not an sp-tag as expected.
        // Consider MutationObserver if tags are added dynamically and this runs too early.
        console.warn('sp-tag found, but shadowRoot is not available:', tag);
        }
    });
}


/**
 * Escape any special RegExp characters in a string.
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Given your scopeFilters array, build a RegExp that enforces:
 *  - at least one active "state" filter (if any exist)
 *  - at least one active "device" filter (if any exist)
 * If no active filters of a given type exist, that type is ignored.
 * If there are zero active filters overall, returns a RegExp that matches everything.
 *
 * @param {Array<{type: "state"|"device", filter: string, active?: boolean|string}>} scopeFilters
 * @returns {RegExp}
 */
function buildScopeRegex(scopeFilters) {
    console.log('scopeFilters', scopeFilters);
  // only keep filters that are truthy/active
  const active = scopeFilters.filter(f =>
    f.active === undefined     // no active flag means include
    || f.active === true        // boolean true
    || f.active === 'true'      // string "true"
  );

  const byType = {
    state: active
      .filter(f => f.type === 'state')
      .map(f => escapeRegex(f.filter)),
    device: active
      .filter(f => f.type === 'device')
      .map(f => escapeRegex(f.filter))
  };

  const lookaheads = [];
  if (byType.state.length) {
    lookaheads.push(`(?=.*(?:${byType.state.join('|')}))`);
  }
  if (byType.device.length) {
    lookaheads.push(`(?=.*(?:${byType.device.join('|')}))`);
  }

  if (!lookaheads.length) {
    // no active filters → match everything
    return /.*/;
  }

  // ^... ensures we apply all lookaheads, and then allow any characters
  const pattern = `^${lookaheads.join('')}.*$`;
  return new RegExp(pattern);
}

export {
    getEl,
    getEls,
    restoreFocus,
    proxyArraysEqual,
    capitalizeFirstLetter,
    parentGroupCount,
    loadManifest,
    setTagLabelCursor,
    buildScopeRegex
};