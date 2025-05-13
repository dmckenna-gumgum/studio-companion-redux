import { action, core } from "photoshop";
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
  
  return name;
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
    try {
      await executeAsModal(
        async () => {
          // First, get a list of all snapshots
          const result = await batchPlay(
            [
              {
                _obj: "get",
                _target: [
                  {
                    _ref: "document",
                    _enum: "ordinal",
                    _value: "targetEnum"
                  }
                ],
                _options: {
                  dialogOptions: "dontDisplay"
                }
              }
            ],
            { synchronousExecution: true }
          );
  
          // If the document has history states with snapshots
          if (result[0]?.historyStates?.length > 0) {
            const historyStates = result[0].historyStates;
            
            // Filter out snapshot history states
            const snapshots = historyStates.filter(state => state._obj === "snapshotClass");
            
            // Delete each snapshot
            for (const snapshot of snapshots) {
              await batchPlay(
                [
                  {
                    _obj: "delete",
                    _target: [
                      {
                        _ref: "snapshotClass",
                        _name: snapshot.name
                      }
                    ],
                    _options: {
                      dialogOptions: "dontDisplay"
                    }
                  }
                ],
                { synchronousExecution: true }
              );
            }
          }
        },
        { commandName: "Clear All Snapshots" }
      );
      return true;
    } catch (error) {
      console.error("Error clearing snapshots:", error);
      return false;
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