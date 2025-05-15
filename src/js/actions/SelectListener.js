const { app, action, constants } = require("photoshop");
const { LayerKind } = constants;
import { createLogger } from '../helpers/logger.js';
import { linkLayersByName } from './linkLayersByName.js';
import { unlinkLayersByName } from './unlinkLayersByName.js';
import { LinkByArrayOfLayers } from './LinkProcessor.js';

import { proxyArraysEqual, parentGroupCount, getSelectionViability } from "../helpers/utils.js";

const logger = createLogger({ prefix: 'SelectListener', initialLevel: 'DEBUG' });
class SelectListener {
    constructor(options = {}) {
        Object.assign(this, options);
        this.selection = {
            layers: [],
            viable: true,
            identical: false,
            sameGroup: true,
            parentGroupCount: 0
        }
        this.autoLink = options.autoLink || false;
        this.linkedLayers = [];
        this._lastSelection = { ...this.selection };
        this.selectionPoll = null;
        this.selectHandler = this.selectHandler.bind(this);
        this.selectionFilters = options.selectionFilters || null;
        action.addNotificationListener([{ event: "select" }], this.selectHandler);
    }
    startSelectionPoll() {
        if (!this.selectionPoll) {
            this.selectionPoll = setInterval(() => { this.selectHandler('select') }, 200);
        }
    }
    stopSelectionPoll() {
        clearInterval(this.selectionPoll);
        this.selectionPoll = null;
    }
    destroy() {
        action.removeNotificationListener([{ event: "select" }], this.selectHandler);
    }
    async setAutoLink(autoLink) {
        logger.debug("Setting autoLink to", autoLink);
        this.autoLink = autoLink;
        this.autoLink ? await LinkByArrayOfLayers(this.selection.layers, this._lastSelection.layers, this.selectionFilters) : await LinkByArrayOfLayers([], this.selection.layers);
    }

    async setSelectionFilters(filters = null) {
        logger.debug("Setting selection filters to", filters);
        this.autoLink && await LinkByArrayOfLayers([], this._lastSelection.layers, this.selectionFilters);
        this.selectionFilters = filters;
        this.autoLink ? await LinkByArrayOfLayers(this.selection.layers, this._lastSelection.layers, this.selectionFilters) : await LinkByArrayOfLayers([], this.selection.layers);
    }

    async selectHandler(event) {
        this.selection.layers = app.activeDocument.activeLayers;
        if (this.selection.layers.length === 0) {
            this.selection = {
                layers: [],
                viable: true,
                identical: false,
                sameGroup: true,
                parentGroupCount: 0
            }
            this.stopSelectionPoll();
            this.callback?.(event, this.selection);
            const unlinkResult = this.autoLink && await LinkByArrayOfLayers([], this._lastSelection.layers, this.selectionFilters);
            this._lastSelection = { ...this.selection };
            logger.debug("(Action Script) Unlink Result:", unlinkResult);
            return unlinkResult;
        } else {
            this.selection.identical = proxyArraysEqual(this.selection.layers, this._lastSelection.layers, this.selectionFilters);
            if (this.selection.identical === true) {
                ///already identical, do not process further
                this._lastSelection = { ...this.selection };
                return this.callback?.(event, this.selection);
            } else {
                try {
                    this.selection.viable = getSelectionViability(this.selection.layers);
                    this.selection.parentGroupCount = parentGroupCount(this.selection.layers);
                    this.startSelectionPoll();
                    this.callback?.(event, this.selection);
                    const linkResult = this.autoLink && await LinkByArrayOfLayers(this.selection.layers, this._lastSelection.layers, this.selectionFilters);
                    this._lastSelection = { ...this.selection };
                    logger.debug("(Action Script) Link Result:", linkResult);
                    return linkResult;
                } catch (error) {
                    console.error("(Action Script) Error linking layers:", error);
                }
            }
        }
    }
}

export { SelectListener };