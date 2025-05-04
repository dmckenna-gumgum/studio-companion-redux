const { app, core } = require("photoshop");
const { LayerKind } = require("photoshop").constants;

/**
 * Finds Artboards or top-level Layer Groups in the active document 
 * whose names contain specific keywords (e.g., ':mb', ':dt', ':tile') based on input types.
 * Special rule: If 'desktop' is requested but not 'tile', excludes containers with ':tile'.
 */


async function getValidContainers(validTypes = []) {
    console.log(`(getValidContainers) Called with validTypes: [${validTypes.join(', ')}]`);
    const activeDoc = app.activeDocument;
    if (!activeDoc) {
        console.error("(getValidContainers) No active document.");
        await core.showAlert("No active document found.");
        return [];
    }

    const containers = [];
    // Map input types to search terms and flags
    
    const requestsMobile = validTypes.includes('mobile');
    const requestsDesktop = validTypes.includes('desktop');
    const requestsTile = validTypes.includes('tile');
    const applyDesktopExclusion = requestsDesktop && !requestsTile;
    const requestsAll = !requestsMobile && !requestsDesktop && !requestsTile;

    console.log(`(getValidContainers) Flags - Mobile: ${requestsMobile}, Desktop: ${requestsDesktop}, Tile: ${requestsTile}, DesktopExclusion: ${applyDesktopExclusion}`);

    // Function to recursively find matching containers
    function findContainersRecursive(layers) {
        if (!layers) return;

        for (const layer of layers) {
            // Only consider Artboards and Groups
            if (layer.kind !== LayerKind.ARTBOARD && layer.kind !== LayerKind.GROUP) {
                // If it's a group (but not matched as a container yet), search inside it
                if (layer.kind === LayerKind.GROUP && layer.layers) {
                   findContainersRecursive(layer.layers);
                }
                continue; // Skip non-container layers for matching purposes
            }

            const layerNameLower = layer.name.toLowerCase();
            if(requestsAll) {
                console.log(`(getValidContainers) Found matching container: ${layer.name} (Type: ${layer.kind}, ID: ${layer.id}) - Reason: Selecting All`);
                containers.push(layer);
            } else {
                let isMatch = false;

                // Check conditions based on requested types
                const hasMb = layerNameLower.includes(':mb');
                const hasDt = layerNameLower.includes(':dt');
                const hasTile = layerNameLower.includes('-tile:');

                if (requestsMobile && hasMb) {
                    isMatch = true;
                }
                if (requestsTile && hasTile) {
                    isMatch = true;
                }
                if (requestsDesktop && hasDt) {
                    if (applyDesktopExclusion) {
                        // If desktop exclusion applies, only match if it *doesn't* have :tile
                        if (!hasTile) {
                            isMatch = true;
                        }
                    } else {
                        // Otherwise, just having :dt is enough for a desktop match
                        isMatch = true;
                    }
                }
                // Add if it's a container match and not already added
                if (isMatch) {
                    if (!containers.some(c => c.id === layer.id)) {
                        console.log(`(getValidContainers) Found matching container: ${layer.name} (Type: ${layer.kind}, ID: ${layer.id}) - Reason: Name contains required term(s)`);
                        containers.push(layer);
                    }
                    // Don't search *inside* a matched container
                    continue; 
                }
                // If it's a group but didn't match the criteria, search inside it
                if (layer.kind === LayerKind.GROUP && layer.layers) {
                    findContainersRecursive(layer.layers);
                }
                // Artboards are treated as top-level, recursion handled by initial call
            }
        }
    }

    console.log("(getValidContainers) Starting search in active document...");
    findContainersRecursive(activeDoc.layers);

    console.log(`(getValidContainers) Found ${containers.length} matching containers.`);
    return containers;
}

module.exports = getValidContainers;
