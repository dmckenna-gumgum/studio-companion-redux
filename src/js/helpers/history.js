import { action, core, app } from "photoshop";
const { batchPlay } = action;
const { executeAsModal } = core;

/*
 *******************************************************
 * Capture a full-document snapshot with the given name.
 * @param {string} name – unique name for this snapshot
 * @returns {string} The name of the created snapshot
 *******************************************************
 */
async function captureSnapshot(name) {
  await executeAsModal(
    async () => {
      await batchPlay(
        [
          {
            _obj: "make",
            _target: [{ _ref: "snapshotClass" }],
            from: { _ref: "historyState", _property: "currentHistoryState" },
            name,
            using: { _enum: "historyState", _value: "fullDocument" },
            _isCommand: true,
            _options: { dialogOptions: "dontDisplay" },
          },
        ],
        {}
      );
    },
    { commandName: "Capture Snapshot" }
  );
  
  const snapshotState = app.activeDocument.historyStates.getByName(name);
  return snapshotState;
}

/*
 *******************************************************
 * Revert the document back to the named snapshot.
 * @param {string} name – name of the snapshot to restore
 *******************************************************
 */
async function restoreSnapshot(name) {
  await executeAsModal(
    async () => {
      await batchPlay(
        [
          {
            _obj: "select",
            _target: [{ _ref: "snapshotClass", _name: name }],
            _isCommand: true,
            _options: { dialogOptions: "dontDisplay" },
          },
        ],
        {}
      );
    },
    { commandName: "Restore Snapshot" }
  );

  return name;
}

/**
 * Clear all snapshots in the current document
 * @returns {boolean} True if operation was successful
 */

async function clearAllSnapshots() {
    // 1) Gather all HistoryState objects that are snapshots
    try {
        const snapshots = app.activeDocument.historyStates.filter(h => h.snapshot);  
        console.log('snapshots', snapshots);
    
        const count = snapshots.length;
        if (count === 0) {
            return 0; // nothing to delete
        }
    
        // 2) Run a modal to delete each snapshot
        await core.executeAsModal(
            async () => {
            for (const snapshot of snapshots.map(s => s._id)) {
                await action.batchPlay(
                    [
                    {
                        _obj: "delete",
                        _target: [
                        // reference the specific historyState by its ID
                        { _ref: "historyState", _id: snapshot.id },
                        // scope it to the correct document
                        { _ref: "document", _id: app.activeDocument.id }
                        ],
                        _isCommand: true,
                        _options: { dialogOptions: "dontDisplay" },
                    },
                    ],
                    {}
                );
                }
            },
            { commandName: "Clear All Snapshots" }
        );  // executeAsModal ensures Photoshop stays responsive during the loop :contentReference[oaicite:1]{index=1}
    
        return count;
    } catch (error) {
        console.error('Error gathering snapshots', error);
    }
}

/*  
 *******************************************************
 * History module that provides snapshot functionality
 *******************************************************
 */
const History = {
  /**
   * Capture a snapshot
   * @param {string} name - Name of the snapshot
   * @returns {string} The name of the created snapshot
   */
  capture: captureSnapshot,
  
  /**
   * Restore a previously captured snapshot
   * @param {string} name - Name of the snapshot to restore
   */
  restore: restoreSnapshot,

  clear: clearAllSnapshots
};

// Named exports for individual function usage
export { captureSnapshot, restoreSnapshot, clearAllSnapshots };

// Default export for importing the entire component
export default History;