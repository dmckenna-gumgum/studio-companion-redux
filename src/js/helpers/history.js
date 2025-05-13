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
  restore: restoreSnapshot
};

// Named exports for individual function usage
export { captureSnapshot, restoreSnapshot };

// Default export for importing the entire component
export default History;