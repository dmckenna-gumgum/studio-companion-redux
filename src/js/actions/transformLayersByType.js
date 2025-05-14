const { app, core, action, constants } = require('photoshop');
const { batchPlay } = action;

/**
 * Gets Smart Object scale and rotation transforms for an array of layers.
 * @param {Layer[]} layers
 * @returns {Promise<Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>>}
 */
const getLayerTransforms = async (layers) => {
    const ids = layers.map(l => l.id);
    const gets = ids.map(id => ({
        _obj: 'get',
        _target: [{ _ref: 'layer', _id: id }],
        _options: { dialogOptions: 'dontDisplay' }
    }));
    const results = await batchPlay(gets, { synchronousExecution: true });
    return results.map(r => {
        const info = r.smartObjectMore;
        if (!info) return null; // not a Smart Object

        // unpack the 8 corner coords
        const [x1, y1, x2, y2, x3, y3, x4, y4] = info.transform;
        const { width: origW, height: origH } = info.size;

        // helper to compute distance
        const dist = (xA, yA, xB, yB) => Math.hypot(xB - xA, yB - yA);

        // current pixel dimensions
        const wPx = dist(x1, y1, x2, y2);
        const hPx = dist(x1, y1, x4, y4);

        // scale percentages
        const widthPct = (wPx * 100) / origW;
        const heightPct = (hPx * 100) / origH;

        // rotation: angle of top edge vector
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

        return {
            layerId: r.layerID,
            widthPct: widthPct,
            heightPct: heightPct,
            rotationDeg: angleDeg
        };
    });
}

/**
 * Converts edges into x,y coords for a rectangle.
 * @param {{top: number, bottom: number, left: number, right: number}} edges
 * @returns {{topLeft: {x: number, y: number}, topRight: {x: number, y: number}, bottomRight: {x: number, y: number}, bottomLeft: {x: number, y: number}}}
 */
const edgesToCoords = ({ top, bottom, left, right }) => ({
    x1: left, y1: top,
    x2: right, y2: top,
    x3: right, y3: bottom,
    x4: left, y4: bottom
});


/**
 * Extract scaleX, scaleY (percent) and rotation (degrees)
 * from a Photoshop/UXP transform matrix descriptor.
 * @param {Object} m  Matrix object with xx, xy, yx, yy (± tx, ty)
 * @returns {{ scaleX:number, scaleY:number, rotation:number }}
 * Example:
 *   const { scaleX, scaleY, rotation } = parseMatrix(layer.transform);
 */
const parseMatrix = (matrix, dp = 8) => {
    const toPsAngle = (xx, yx) => -(Math.atan2(yx, xx) * 180 / Math.PI);

    const round = v => +(parseFloat(v).toFixed(dp));    // unary +  ===  Number(...)
    const { xx, xy, yx, yy } = Object.fromEntries(
        Object.entries(matrix).map(([k, v]) => [k, round(v)])
    );

    // 1. raw scales (unitless ratios)
    const scaleX = Math.hypot(xx, yx);                // √(xx² + yx²)
    const scaleY = Math.hypot(xy, yy);                // √(xy² + yy²)
    const rotation = toPsAngle(xx, yx);//Math.atan2(yx, xx) * 180 / Math.PI;

    // 3. return scales as *percent* to match Photoshop’s UI
    return {
        scaleX: round(scaleX * 100),
        scaleY: round(scaleY * 100),
        rotation: round(rotation)
    };
}

/**
 * Get transforms for text layers.
 * Uses their persistent pathBound properties.
 * @param {Layer[]} layers
 * @returns {Promise<Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>>}
 */
const getTextTransforms = async (layers) => {
    const descriptors = layers.map(l => ({
        _obj: 'get',
        _target: [{ _ref: 'layer', _id: l.id }],
        _options: { dialogOptions: 'dontDisplay' }
    }));
    const results = await batchPlay(descriptors, { synchronousExecution: true });

    return results.map(r => {
        const transform = r.textKey.transform;
        const transformations = parseMatrix(transform);
        return {
            layerId: r.layerID,
            widthPct: 100,
            heightPct: 100,
            rotationDeg: transformations.rotation,
            transformations: transformations
        };
    });
}

/**
 * Get transforms for shape layers (path-based and primitive).
 * Uses their persistent pathBound properties.
 * @param {Layer[]} layers
 * @returns {Promise<Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>>}
 */
const getShapeTransforms = async (layers) => {
    const descriptors = layers.map(l => ({
        _obj: 'get',
        _target: [{ _ref: 'layer', _id: l.id }],
        _options: { dialogOptions: 'dontDisplay' }
    }));
    const results = await batchPlay(descriptors, { synchronousExecution: true });
    console.log("(Action Script) Results:", results);

    return results.map(r => {
        const refRect = r.pathBounds?.pathBounds
        // unpack the 8 corner coords
        console.log("(Action Script) RefRect:", refRect);
        const { x1, y1, x2, y2, x3, y3, x4, y4 } = edgesToCoords(refRect);
        const { width, height } = { width: Math.abs(x1 - x2), height: Math.abs(y2 - y3) };
        console.log("(Action Script) Width, Height:", { x1, y1, x2, y2, x3, y3, x4, y4 }, width, height);
        const dist = (xA, yA, xB, yB) => Math.hypot(xB - xA, yB - yA);
        const wPx = dist(x1, y1, x2, y2);
        const hPx = dist(x1, y1, x4, y4);
        const widthPct = (wPx * 100) / width;
        const heightPct = (hPx * 100) / height;

        return {
            layerId: r.layerID,
            widthPct: widthPct,
            heightPct: heightPct,
            rotationDeg: 0
        };
    });
}

/**
 * Gets default transforms for raster layers (100% scale, 0° rotation).
 * @param {Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>} layers
 * @returns {Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>}
 */
const getRasterTransforms = (layers) => {
    return layers.map(l => ({ layerId: l.id, widthPct: 100, heightPct: 100, rotationDeg: 0 }));
}

/**
 * Sets Smart Object scale and rotation transforms.
 * @param {Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>} transforms
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Array<{layerId:number,width:number,height:number,angle:number}>>}
 */
const setLayerTransforms = async (transforms, scale, rotation) => {
    console.log("(setLayerTransforms) Setting layer transforms:", scale, rotation);
    const sets = transforms.flatMap(t => [
        {
            _obj: 'select',
            _target: [{ _ref: 'layer', _id: t.layerId }],
            _options: { dialogOptions: 'dontDisplay' }
        },
        {
            _obj: 'transform',
            _target: [{ _ref: 'layer', _id: t.layerId }],
            freeTransformCenterState: { _enum: 'quadCenterState', _value: 'QCSAverage' },
            width: { _unit: 'percentUnit', _value: t.widthPct * scale },
            height: { _unit: 'percentUnit', _value: t.heightPct * scale },
            angle: { _unit: 'angleUnit', _value: t.rotationDeg + rotation },
            interfaceIconFrameDimmed: { _enum: 'interpolationType', _value: 'bicubicAutomatic' },
            _options: { dialogOptions: 'dontDisplay' }
        }
    ]);
    const results = await batchPlay(sets, { synchronousExecution: true });
    return results
        .filter((_, i) => i % 2 === 0)
        .map((item, i) => {
            const next = results[2 * i + 1] || {};
            return Object.fromEntries(
                ['layerID', 'width', 'height', 'angle']
                    .filter(k => k in item || k in next)
                    .map(k => [k, k in item ? item[k] : next[k]])
            );
        });
}
/**
 * Sets shape layer scale and rotation transforms.
 * @param {Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>} transforms
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Array<{layerId:number,width:number,height:number,angle:number}>>}
 */
const setShapeTransforms = async (transforms, scale, rotation) => {
    const sets = transforms.flatMap(t => [
        {
            _obj: "select",
            _target: [{ _ref: "layer", _id: t.layerId }],
            _options: { dialogOptions: "dontDisplay" }
        },
        {
            _obj: "transform",
            _target: [{ _ref: "layer", _id: t.layerId, _enum: "ordinal", _value: "targetEnum" }],
            freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
            width: { _unit: "percentUnit", _value: t.widthPct * scale },
            height: { _unit: "percentUnit", _value: t.heightPct * scale },
            angle: { _unit: "angleUnit", _value: t.rotationDeg + rotation },
            _options: { dialogOptions: "dontDisplay" }
        }
    ]);
    const results = await batchPlay(sets, { synchronousExecution: true });
    // merge pairs → one entry per transform
    return results.filter((_, i) => i % 2 === 0).map((r, i) => {
        const next = results[2 * i + 1] || {};
        return {
            layerId: r.layerID || next.layerID,
            width: r.width || next.width,
            height: r.height || next.height,
            angle: r.angle || next.angle
        };
    });
}

/**
 * Sets text layer scale and rotation transforms.
 * @param {Array<{layerId:number,widthPct:number,heightPct:number,rotationDeg:number}>} transforms
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Array<{layerId:number,width:number,height:number,angle:number}>>}
 */
const setTextTransforms = async (transforms, scale, rotation) => {
    console.log("(setTextTransforms) Rotation To Apply:", rotation);
    const sets = transforms.flatMap(t => {
        return [
            {
                _obj: "select",
                _target: [{ _ref: "layer", _id: t.layerId }],
                _options: { dialogOptions: "dontDisplay" }
            },
            {
                _obj: "transform",
                _target: [{ _ref: "layer", _id: t.layerId, _enum: "ordinal", _value: "targetEnum" }],
                freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
                angle: { _unit: "angleUnit", _value: rotation },
                height: { _unit: "percentUnit", _value: t.heightPct * scale },
                interfaceIconFrameDimmed: { _enum: "interpolationType", _value: "bicubic" },
                width: { _unit: "percentUnit", _value: t.widthPct * scale },
                _options: { dialogOptions: "dontDisplay" }
            }
        ]
    });
    const results = await batchPlay(sets, { synchronousExecution: true });
    // console.log("(setTextTransforms) Results from BatchPlay:", results);
    // merge pairs → one entry per transform
    //this just gets the results back into a format that can be used by the rest of the code
    return results.filter((_, i) => i % 2 === 0).map((r, i) => {
        const next = results[2 * i + 1] || {};
        return {
            layerId: r.layerID || next.layerID,
            width: r.width || next.width,
            height: r.height || next.height,
            angle: r.angle || next.angle
        };
    });
}

/**
 * Handler for Smart Object layers.
 * @param {Layer[]} layers
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Object[]>}
 */
const processSmartObjectLayers = async (layers, scale, rotation) => {
    const transforms = await getLayerTransforms(layers);
    return await setLayerTransforms(transforms, scale, rotation);
}

/**
 * Handler for raster (pixel) layers.
 * @param {Layer[]} layers
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Object[]>}
 */
const processRasterLayers = async (layers, scale, rotation) => {
    const transforms = await getRasterTransforms(layers);
    return await setLayerTransforms(transforms, scale, rotation);
}

/**
 * Handler for  shape layers.
 * @param {Layer[]} layers
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Object[]>}
 */
const processShapeLayers = async (layers, scale, rotation) => {
    //additional handling here before getting transforms
    const transforms = await getShapeTransforms(layers);
    return await setShapeTransforms(transforms, scale, rotation);
}


/**
 * Handler for text (font) layers.
 * Converts to shape then transforms.
 * @param {Layer[]} layers
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Object[]>}
 */
const processFontLayers = async (layers, scale, rotation) => {
    const transforms = await getTextTransforms(layers);
    return await setTextTransforms(transforms, scale, rotation);
}

/**
 * Router for layer type specific transform handlers.
 * Attempts to avoid destructive edits whereever possible.
 * @param {Layer[]} layers
 * @param {number} scale
 * @param {number} rotation
 * @returns {Promise<Object[]>}
 */
const transformLayersByType = async (selectedLayers, scale, rotation) => {
    try {
        const rasters = [], shapes = [], texts = [], smartObjs = [];
        selectedLayers.forEach(l => {
            switch (l.kind) {
                case constants.LayerKind.NORMAL: rasters.push(l); break;
                case constants.LayerKind.SOLIDFILL: shapes.push(l); break;
                case constants.LayerKind.TEXT: texts.push(l); break;
                case constants.LayerKind.SMARTOBJECT: smartObjs.push(l); break;
            }
        });
        const [smartRes, rasterRes, shapeRes, textRes] = await Promise.all([
            smartObjs.length ? processSmartObjectLayers(smartObjs, scale, rotation) : [],
            rasters.length ? processRasterLayers(rasters, scale, rotation) : [],
            shapes.length ? processShapeLayers(shapes, scale, rotation) : [],
            texts.length ? processFontLayers(texts, scale, rotation) : []
        ]);

        return [...smartRes, ...rasterRes, ...shapeRes, ...textRes];
    } catch (error) {
        console.error("(Action Script) Error in transformLayersByType:", error);
        throw error;
    }
}

export { transformLayersByType, getLayerTransforms };
