const { storage } = require('uxp');
const { app, action, constants, core } = require("photoshop");
const { LayerKind } = constants;
//////////////////////////////////////
////////////UTILITIES/////////////
//////////////////////////////////////
/**
 * This is an insanely stupid workaround for an issue where UXP is unable to restore focus 
 * for keyboard shortcuts after a UXP scipt executes. it's not documented, but they found 
 * this fix in the UXP SDK forum. Fuck you adobe, this was 3 hours of my life i'll never get back.
 * @see https://forums.creativeclouddeveloper.com/t/clicking-any-button-on-any-uxp-panel-inactivates-keyboard-shortcuts-for-tools-and-brush-sizes/2379/11
 */
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

/**
 * Replaces the ${step} placeholder in a pattern string with the provided step value
 * @param {string} pattern - The string containing the ${step} placeholder
 * @param {string|number} step - The value to replace the placeholder with
 * @returns {string} - The pattern with ${step} replaced by the provided step value
 */
function replaceStep(pattern, step) {
    return pattern.replace(/\$\{step\}/g, step);
}

/**
 * Loads and parses the plugin's manifest.json file
 * @async
 * @returns {Promise<Object>} - The parsed manifest as a JavaScript object
 */
async function loadManifest() {
    const pluginFolder = await storage.localFileSystem.getPluginFolder();
    const manifestFile = await pluginFolder.getEntry('manifest.json');
    const text = await manifestFile.read();
    return JSON.parse(text);
}

/**
 * Returns a Set containing the unique parent IDs from an array of layers
 * @param {Array<Object>} layers - Array of layer objects with parent property
 * @returns {Set} - Set of unique parent IDs
 */
function parentGroupCount(layers) {
    return new Set(layers.map(l => l.parent?.id))
}

/**
 * Shorthand for document.querySelector
 * @param {string} selector - CSS selector string
 * @returns {Element|null} - The first element matching the selector, or null if none found
 */
function getEl(selector) {
    return document.querySelector(selector);
}

/**
 * Shorthand for document.querySelectorAll
 * @param {string} selector - CSS selector string
 * @returns {NodeList} - All elements matching the selector
 */
function getEls(selector) {
    return document.querySelectorAll(selector);
}

/**
 * Compares two arrays and returns information about added, removed, and changed elements
 * @param {Array} oldArr - The original array
 * @param {Array} newArr - The new array to compare against
 * @returns {Object} - Object containing arrays of added, removed, and changed elements with their indices
 * @throws {TypeError} - If either argument is not an array
 */
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

/**
 * Compares two proxy arrays of Photoshop objects for equality based on their _docId and _id properties
 * @param {Array} a - First proxy array to compare
 * @param {Array} b - Second proxy array to compare
 * @returns {boolean} - True if arrays contain the same objects (based on _docId and _id), false otherwise
 */
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
        // if either missing or ids don't match → not equal
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

/**
 * Capitalizes the first letter of a string
 * @param {string} string - The input string to capitalize
 * @returns {string} - The input string with first letter capitalized
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Escapes special RegExp characters in a string
 * @param {string} s - String to escape
 * @returns {string} - String with all RegExp special characters escaped
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
/**
 * Builds a regular expression that matches strings based on active scope filters
 * @param {Array<Object>} scopeFilters - Array of filter objects with type, filter, and active properties
 * @returns {RegExp} - Regular expression that matches strings matching the active filters
 */
function buildScopeRegex(scopeFilters) {
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

/**
 * Builds a regex pattern that matches any of the provided artboard name patterns
 * @param {string|string[]} strings - Single pattern string or array of pattern strings
 * @returns {RegExp} - Regular expression that will match if any of the patterns match a string
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

/**
 * Merges two arrays of objects based on a specified key property
 * Items from payloadArray will override items in sourceArray with the same key
 * @param {Array<Object>} sourceArray - The original array of objects
 * @param {Array<Object>} payloadArray - The array of objects to merge in (takes precedence)
 * @param {string} key - The property name to use as the unique identifier
 * @returns {Array<Object>} - A new array with merged unique items
 */
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

/**
 * Logs initialization data for the plugin to the console
 * @param {Object} manifest - The plugin manifest data
 * @param {Object} versions - Object containing version information (e.g., uxp version)
 * @param {Object} host - Host application information (name, version)
 * @param {Object} document - Active document information (name, path)
 * @param {string} arch - System architecture
 * @param {string} platform - Operating system platform
 * @param {string} theme - Current Photoshop theme
 */
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

/**
 * Searches an array for items matching all provided criteria
 * Supports deep searching in nested objects and arrays, and handles various match types
 * @param {Array<Object>|Object} sourceArray - The array or object to search in
 * @param {Object} criteria - Key-value pairs to match against items in the array
 * @returns {Array<Object>} - Array of matching items
 */
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

/**
 * Creates a new object with only the specified properties from the source object
 * If a property doesn't exist in the source, it uses the value from defaultSchema
 * @param {Object} obj - Source object to pick properties from
 * @param {Array<string>} keysToKeep - Array of property keys to keep
 * @param {Object} [defaultSchema={}] - Default values for missing properties
 * @returns {Object} - New object with only the specified properties
 */
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

/**
 * Creates a cartesian product of multiple arrays
 * @param {...Array} arrays - Arrays to create product from
 * @returns {Array<Array>} - Array of arrays representing all possible combinations
 */
function cartesianProduct(...arrays) {
    return arrays
        .reduce(
            (acc, curr) =>
                acc.flatMap(a => curr.map(b => [...a, b])),
            [[]]
        );
}

/**
 * Split two object-arrays into:
 *   • onlyInA  – items whose id exists *only* in arrayA
 *   • onlyInB  – items whose id exists *only* in arrayB
 *   • inBoth   – items whose id exists in *both* arrays
 *
 * @template T
 * @param {T[]} arrayA
 * @param {T[]} arrayB
 * @param {string} [idKey='id']
 * @returns {{ onlyInA: T[], onlyInB: T[], inBoth: T[] }}
 */
function diffArraysByIds(arrayA = [], arrayB = [], idKey = 'id') {
    const idsA = new Map(arrayA.map(item => [item[idKey], item])); // id → item
    const idsB = new Map(arrayB.map(item => [item[idKey], item]));

    const onlyA = [];
    const onlyB = [];
    const both = [];

    // Walk A first so we can fill inBoth immediately
    for (const [id, itemA] of idsA) {
        if (idsB.has(id)) {
            both.push(itemA);            // or push idsB.get(id) — they share the id
            idsB.delete(id);               // mark as handled
        } else {
            onlyA.push(itemA);
        }
    }

    // Anything left in idsB never appeared in A
    onlyB.push(...idsB.values());

    return { onlyA, onlyB, both };
}

/**
 * Pull four pieces out of a panel name such as
 *   "morph-2-expanded-panel:mb"
 *
 *   • before  → "morph"
 *   • number  → 2               (as Number)
 *   • after   → "expanded-panel"
 *   • device  → ":mb"           (includes the colon)
 *
 * @param {string} str - The panel name string to parse
 * @returns {Object} - Object containing the parsed components: before, number, after, and device
 * @throws {Error} - If the string is not a valid panel name format
 */
function parsePanelName(str) {
    const m = /^([^-:]+)-?(\d+)-?([^:]+)(:[a-zA-Z]+)$/.exec(str);
    if (!m) throw new Error(`"${str}" is not a valid panel name`);

    const [, before, num, after, device] = m;
    return {
        before,                 // "morph"
        number: Number(num),   // 2
        after,                   // "expanded-panel"
        device                    // ":mb"
    };
}

/**
 * Sets cursor style on label spans within Spectrum Web Components tags' shadow DOM. This workaround 
 * is needed because UXP doesn't support the web component pseudo selectors needed for piercing shadow DOM.
 * @param {NodeList|Array<Element>} elements - Collection of sp-tag elements to modify
 * @param {string} [newCursorValue='pointer'] - CSS cursor value to apply
 */
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

const VALID_LAYER_KINDS = new Set([
    LayerKind.BLACKANDWHITE, LayerKind.BRIGHTNESSCONTRAST, LayerKind.CHANNELMIXER,
    LayerKind.COLORBALANCE, LayerKind.COLORLOOKUP, LayerKind.CURVES,
    LayerKind.EXPOSURE, LayerKind.GRADIENTFILL, LayerKind.GRADIENTMAP,
    LayerKind.HUESATURATION, LayerKind.INVERSION, LayerKind.LAYER3D,
    LayerKind.LEVELS, LayerKind.NORMAL, LayerKind.PATTERNFILL,
    LayerKind.PHOTOFILTER, LayerKind.POSTERIZE, LayerKind.SELECTIVECOLOR,
    LayerKind.SMARTOBJECT, LayerKind.SOLIDFILL, LayerKind.TEXT,
    LayerKind.THRESHOLD, LayerKind.VIBRANCE, LayerKind.VIDEO
]);

/**
 * Determines if the current layer selection is viable based on layer types
 * @param {Array<Object>} layers - Array of layer objects to evaluate
 * @returns {Object} - Object with type ('group', 'layer', or 'mixed') and viable (boolean) properties
 */
const getSelectionViability = layers => {
    const total = layers.length;
    const groupCount = layers.filter(l => l.kind === LayerKind.GROUP).length;

    const type =
        groupCount === total ? 'group' :
            groupCount === 0 && layers.every(l => VALID_LAYER_KINDS.has(l.kind))
                ? 'layer' :
                'mixed';

    console.log("(getSelectionViability) Type:", type);
    console.log("(getSelectionViability) Viable:", type !== 'mixed');

    return { type, viable: type !== 'mixed' };
};

/**
 * Merges two arrays of objects by unique ID, with a2 taking precedence over a1
 * @param {Array<Object>} a1 - First array of objects with id property
 * @param {Array<Object>} a2 - Second array of objects with id property (takes precedence)
 * @returns {Array<Object>} - Array with unique items based on id property
 */
const mergeUniqueById = (a1, a2) =>
    [...new Map([...a2, ...a1].map(obj => [obj.id, obj])).values()];

/**
 * Returns true when two arrays contain exactly the same unique-id set
 * (order doesn’t matter, duplicates are ignored).
 *
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @param {string} [idKey='id']  — property that holds the unique ID
 * @returns {boolean}
 */
function sameIdSet(a, b, idKey = 'id') {
    // Early exit if the simple math can already prove “not equal”
    if (a.length !== b.length) return false;

    const idsA = new Set(a.map(o => o[idKey]));
    if (idsA.size !== a.length) throw new Error('Array A has duplicate IDs');

    // Every id in B must exist in idsA, and sizes must match
    for (const o of b) if (!idsA.has(o[idKey])) return false;

    return true; // all checks passed ⇒ same id set
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
    mergeUniqueById,
    diffArraysByIds,
    sameIdSet
};