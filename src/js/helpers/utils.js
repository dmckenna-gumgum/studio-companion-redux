const { storage } = require('uxp');
const { app, action, constants, core } = require("photoshop");
const { LayerKind } = constants;
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
    const cmds = [2982, 2986, 2986];
    cmds.map(cmd => core.performMenuCommand({
      commandID: cmd,
      kcanDispatchWhileModal: true,
      _isCommand: false
    }));
  }
}

function replaceStep(pattern, step) {
  return pattern.replace(/\$\{step\}/g, step);
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

function diffProxyArrays(oldArr, newArr) {
  if (!Array.isArray(oldArr) || !Array.isArray(newArr)) {
    throw new TypeError('Both arguments must be arrays (or proxies of arrays).');
  }

  const lenOld = oldArr.length;
  const lenNew = newArr.length;
  const minLen = Math.min(lenOld, lenNew);

  const added = [];
  const removed = [];
  const changed = [];

  // 1. Check changed values at overlapping indices
  for (let i = 0; i < minLen; i++) {
    if (!Object.is(oldArr[i], newArr[i])) {
      changed.push({ index: i, from: oldArr[i], to: newArr[i] });
    }
  }

  // 2. Any extra in newArr are “added”
  for (let i = minLen; i < lenNew; i++) {
    added.push({ index: i, value: newArr[i] });
  }

  // 3. Any extra in oldArr are “removed”
  for (let i = minLen; i < lenOld; i++) {
    removed.push({ index: i, value: oldArr[i] });
  }

  return { added, removed, changed };
}

function proxyArraysEqual(a, b) {
  // same reference → equal
  if (a === b) return true;
  // must both be arrays of the same length
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  // loop once, compare both keys
  for (let i = 0, len = a.length; i < len; i++) {
    const o1 = a[i], o2 = b[i];
    // if either missing or ids don’t match → not equal
    if (
      !o1 || !o2 ||
      o1._docId !== o2._docId ||
      o1._id !== o2._id
    ) {
      return false;
    }
  }
  return true;
}
// function proxyArraysEqual(a, b) {
//     // 1) If they’re literally the same object, they’re equal
//     console.log('literal check', a === b);    
//     if (a === b) return true;

//     // 2) Both must be array-like and same length
//     console.log('array like', !Array.isArray(a) || !Array.isArray(b) || a.length !== b.length);    
//     if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
//         return false;
//     }

//     // 3) Compare each entry to check doc and layer ids match
//     console.log('same entries', a.every((elementA, i) => elementA._docId === b[i]._docId && elementA._id === b[i]._id));    
//     return a.every((elementA, i) => elementA._docId === b[i]._docId && elementA._id === b[i]._id);
// }

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
  console.log('pattern', pattern);
  return new RegExp(pattern);
}

/**
 * Builds a regex pattern that matches any of the provided artboard name patterns
 * @param {string|string[]} artboardNamePatterns - Single pattern string or array of pattern strings
 * @returns {RegExp} - Regex that will match if any of the patterns matches a string
 */
function buildArtBoardSearchRegex(strings) {
  // Handle both single string and array of strings
  if (!Array.isArray(strings)) {
    strings = [strings];
  }

  // Create a pattern that matches if any of the strings match
  // Each string is anchored with ^ and $ to ensure exact matches
  const pattern = strings
    .map(name => `^${name}$`)
    .join('|');

  return new RegExp(pattern);
}

function mergeArraysByKey(sourceArray, payloadArray, key) {
  if (!Array.isArray(sourceArray) || !Array.isArray(payloadArray)) {
    return sourceArray || payloadArray || [];
  }

  // Create a merged map where payload items override existing items
  const updatedItemsMap = new Map(
    // Start with the source array items
    [...sourceArray.filter(item => item[key]).map(item => [item[key], item])]
      // Merge with payload items, with payload taking precedence
      .concat(
        payloadArray
          .filter(item => item[key])
          .map(item => [item[key], item])
      )
  );

  // Convert map back to array
  return [...updatedItemsMap.values()];
}

function logInitData(manifest, versions, host, document, arch, platform, theme) {
  try {
    // console.clear();
    console.info("----------------------------------------------------------");
    console.log("----------------------------------------------------------");
    console.log('\n');
    console.log(`%cPLUGIN INFO`, 'font-weight: bolder; font-size: 16px;');
    console.log(`Loaded: ${manifest.id}`);
    console.log(`Version: ${manifest.version}`);
    console.log(`UXP Version: ${versions.uxp}`);
    console.log('\n');
    console.log(`%cAPPLICATION INFO`, 'font-weight: bolder; font-size: 16px;');
    console.log(`Requires Min ${host.name} Version: ${manifest.host[0].minVersion}`);
    console.log(`User Running ${host.name} Version: ${host.version}`);
    console.log(`Current Theme: ${capitalizeFirstLetter(theme)}`);
    console.log(`On Platform: ${platform === 'win32' ? 'Windows' : 'Mac'} ${arch}`);
    console.log('\n');
    console.log(`%cDOCUMENT INFO`, 'font-weight: bolder; font-size: 16px;');
    console.log(`Active Document: ${document.name}`);
    console.log(`Active Document Path: ${document.path}`);
    console.log('\n');
    console.log("----------------------------------------------------------");
    console.log("----------------------------------------------------------");
  } catch (error) {
    console.error('Error logging initialization data', error);
  }
}

function findInArray(sourceArray, criteria) {
  // Handle non-array inputs gracefully
  if (!Array.isArray(sourceArray)) {
    // If it's an object, try to find a property matching the first key in criteria
    if (sourceArray && typeof sourceArray === 'object') {
      const firstKey = Object.keys(criteria)[0];
      if (firstKey && sourceArray[firstKey] !== undefined) {
        // If it's a direct property match, return it wrapped in an array
        if (sourceArray[firstKey] === criteria[firstKey]) {
          return [sourceArray];
        }
        // If it's a property pointing to an array, recursively search in it
        if (Array.isArray(sourceArray[firstKey])) {
          // Remove the matched key from criteria for the next search
          const { [firstKey]: _, ...remainingCriteria } = criteria;
          return Object.keys(remainingCriteria).length > 0
            ? findInArray(sourceArray[firstKey], remainingCriteria)
            : sourceArray[firstKey];
        }
      }
    }
    return [];
  }

  // Filter the array by matching ALL criteria
  return sourceArray.filter(item => {
    if (!item || typeof item !== 'object') return false;

    return Object.entries(criteria).every(([key, value]) => {
      // Handle arrays for both the item's property and the criteria value
      if (Array.isArray(item[key]) && Array.isArray(value)) {
        // Check if at least one value in the array matches
        return value.some(v => item[key].includes(v));
      }
      // Handle array for just the criteria value (checking if item's property is in the criteria array)
      if (Array.isArray(value)) {
        return value.includes(item[key]);
      }
      // Handle array for just the item's property (checking if criteria value is in the item's array)
      if (Array.isArray(item[key])) {
        return item[key].includes(value);
      }
      // Simple equality check for primitives and other values
      return item[key] === value;
    });
  });
}

function pickProps(obj, keysToKeep, defaultSchema = {}) {
  // helper to get a fresh clone of the schema:
  const makeClone = () =>
  // you can swap this for structuredClone(defaultSchema)
  // or _.cloneDeep(defaultSchema) if you need deep cloning
  { return { ...defaultSchema }; };

  const result = {};
  for (const key of keysToKeep) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    } else {
      result[key] = makeClone();
    }
  }
  return result;
}

function cartesianProduct(...arrays) {
  return arrays
    .reduce(
      (acc, curr) =>
        acc.flatMap(a => curr.map(b => [...a, b])),
      [[]]
    );
}

const getSelectionViability = (layers) => {
  ///if some selected layers are groups, BUT not all of them are groups, then it's not viable - We don't want to be applying transformations
  /// to individual layers and artboards on the same action because it'll produce weird results.
  return !layers.some(item => item.kind === LayerKind.GROUP) && layers.every(item => item.kind !== LayerKind.GROUP)
}

const mergeUniqueById = (a1, a2) =>
  [...new Map([...a2, ...a1].map(obj => [obj.id, obj])).values()];

export {
  getEl,
  getEls,
  restoreFocus,
  proxyArraysEqual,
  capitalizeFirstLetter,
  parentGroupCount,
  loadManifest,
  setTagLabelCursor,
  buildScopeRegex,
  buildArtBoardSearchRegex,
  logInitData,
  replaceStep,
  mergeArraysByKey,
  findInArray,
  pickProps,
  cartesianProduct,
  diffProxyArrays,
  getSelectionViability,
  mergeUniqueById
};