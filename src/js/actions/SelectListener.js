const { app, action } = require("photoshop");

class SelectListener {
    constructor(options = {}) {
        Object.assign(this, options)
        this.selectHandler = this.selectHandler.bind(this);      
        this.selectionPoll = null;  
        action.addNotificationListener([{ event: "select" }],  this.selectHandler);
    }
    startSelectionPoll() {
        if(!this.selectionPoll) {
            this.selectionPoll = setInterval(this.selectHandler, 200);
        }
    }      
    stopSelectionPoll() {
        clearInterval(this.selectionPoll);
        this.selectionPoll = null;
    }
    destroy() {
        action.removeNotificationListener([{ event: "select" }],  this.selectHandler);
    }      
    async selectHandler() {
        const active = app.activeDocument.activeLayers;
        if (active.length === 0) {
            this.stopSelectionPoll();
            this.callback?.(active);
        } else {
           this.startSelectionPoll();
            this.callback?.(active);
        }
    }
}

export { SelectListener };
