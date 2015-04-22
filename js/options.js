document.addEventListener('DOMContentLoaded', function () {
    chrome.runtime.getBackgroundPage(function (bg) {
        var Shortcuts = bg.DefaultActions;
        var ShortcutOption = bg.ShortcutOptions;
        for(var shortcutId in Shortcuts) {
            if (Shortcuts.hasOwnProperty(shortcutId)) {
                var SelectBox = document.getElementById(shortcutId);
                for (var optionId in ShortcutOption){
                    if (ShortcutOption.hasOwnProperty(optionId)) {
                        (function UpdateSelected(select, shortcut, opt) {
                            chrome.storage.sync.get(shortcut, function (val) {
                                var option = document.createElement("option");
                                option.text = ShortcutOption[opt];
                                if (opt == val[shortcut]) {
                                    option.selected = true
                                }
                                select.add(option);
                                // TODO: error here
                            });
                        })(SelectBox, shortcutId, optionId);
                    }
                }
            }
        }
    });
});
// Add listener when changing