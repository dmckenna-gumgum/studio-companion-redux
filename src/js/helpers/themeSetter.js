// 1. Helper: ask Photoshop what theme it’s using
const { action } = require('photoshop');
async function getPSTheme() {
    const result = await action.batchPlay([
        {
            _obj: "get",
            _target: [
                { _property: "kuiBrightnessLevel" },
                { _ref: "application", _enum: "ordinal", _value: "targetEnum" },
            ],
            _options: { dialogOptions: "dontDisplay" },
        }],
    {});
    console.log(result);
    const brightness = result[0].kuiBrightnessLevel._value;
    console.log(brightness);
    return {
        kPanelBrightnessDarkGray: "darkest",
        kPanelBrightnessMediumGray:  "darkest",
        kPanelBrightnessLightGray:   "light",
        kPanelBrightnessOriginal:    "light",
    }[brightness] || "darkest";
}

export { getPSTheme };
