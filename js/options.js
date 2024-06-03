const DefaultActions = {
    'defaultActions': 'passed',
    'ShiftMiddleClick': 'active',
    'CtrlShiftClick': 'active',
    'CtrlClick': 'inactive',
    'MiddleClick': 'inactive',
    'ShiftClick': 'window',
    'Click': 'same',
    'Key': 'same',
    'ShiftKey': 'inactive'
};

const ShortcutOptions = {
    'active': 'In a new tab and switch to it',
    'inactive': 'In a new tab but in the background',
    'same': 'In the same tab',
    'window': 'In a new window',
    'none': 'None'
};

const DefaultBGColor = '#EEEEEE';

document.addEventListener('DOMContentLoaded', function () {

    chrome.storage.sync.get(null, function (val) {
        const Actions = DefaultActions;
        const ShortcutOption = ShortcutOptions;
        for (const shortcutId in Actions) {
            if (Actions.hasOwnProperty(shortcutId) && shortcutId !== 'defaultActions') {
                $.each(ShortcutOption, function (key, value) {
                    $("#" + shortcutId).append($("<option></option>").attr("value", key).text(ShortcutOption[key]));
                });
                $("#" + shortcutId + " option[value=" + Actions[shortcutId] + "]").prop("selected", "selected");
            }
        }
    });

    // Set to default actions
    $("#shortcut-default").click(function () {
        const Actions = DefaultActions;
        for (const shortcutId in Actions) {
            if (Actions.hasOwnProperty(shortcutId) && shortcutId !== 'defaultActions') {
                $("#" + shortcutId + " option[value=" + Actions[shortcutId] + "]").prop("selected", "selected");
            }
        }
        chrome.storage.sync.set(Actions);
    });

    // Update settings
    const Actions = DefaultActions;
    for (const shortcutId in Actions) {
        if (Actions.hasOwnProperty(shortcutId) && shortcutId !== 'defaultActions') {
            (function (sId) {
                $("#" + sId).change(function () {
                    let str = "";
                    $("#" + sId + " option:selected").each(function () {
                        str = $(this).val();
                    });
                    const storeSetting = {};
                    storeSetting[sId] = str;
                    chrome.storage.sync.set(storeSetting);
                });
            })(shortcutId);
        }
    }

    // Background color
    const defaultColor = DefaultBGColor;
    chrome.storage.sync.get('bgColor', function (val) {
        let initialColor = defaultColor;
        if (val['bgColor'] !== null && typeof val['bgColor'] !== "undefined") {
            initialColor = val['bgColor'];
        }
        // Display current setting
        document.querySelector('input[type="color"]').value = initialColor;
    });

    // Update setting when changing
    $('#colorpicker').on("change", function () {
        chrome.storage.sync.set({bgColor: $("#colorpicker").val()});
    });

    // Set to default color
    $("#bgcolor-default").click(function () {
        $('#colorpicker').val(defaultColor);
        chrome.storage.sync.set({bgColor: defaultColor});
    });
});
