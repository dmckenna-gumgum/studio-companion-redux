const { app, action } = require("photoshop");
import { createLogger } from '../helpers/logger.js';
const logger = createLogger({ prefix: 'SelectListener', initialLevel: 'DEBUG' });

class SelectListener {
    constructor(options = {}) {
        Object.assign(this, options)
        this.selectHandler = this.selectHandler.bind(this);      
        this.selectionPoll = null;  
        action.addNotificationListener([{ event: "select" }],  this.selectHandler);
    }
    startSelectionPoll() {
        if(!this.selectionPoll) {
            this.selectionPoll = setInterval( () => { this.selectHandler('select') }, 200);
        }
    }      
    stopSelectionPoll() {
        clearInterval(this.selectionPoll);
        this.selectionPoll = null;
    }
    destroy() {
        action.removeNotificationListener([{ event: "select" }],  this.selectHandler);
    }      
    async selectHandler(event) {
        const active = app.activeDocument.activeLayers;
        if (active.length === 0) {
            this.stopSelectionPoll();
            this.callback?.(event, active);
        } else {
           this.startSelectionPoll();
            this.callback?.(event, active);
        }
    }
}

export { SelectListener };
