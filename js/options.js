document.addEventListener('DOMContentLoaded', function () {
    chrome.runtime.getBackgroundPage(function (bg) {
        chrome.storage.sync.get(null, function (val) {
            var Actions = bg.DefaultActions;
            var ShortcutOption = bg.ShortcutOptions;
            for(var shortcutId in Actions) {
                if (Actions.hasOwnProperty(shortcutId) && shortcutId != 'defaultActions') {
                    $.each(ShortcutOption, function(key, value) {
                        $("#" + shortcutId).append($("<option></option>").attr("value",key).text(ShortcutOption[key]));
                    });
                    $("#" + shortcutId + " option[value=" + val[shortcutId] + "]").prop("selected", "selected");
                }
            }
        });
    });
});

// Set to default
$("#shortcut-default").click(function () {
    chrome.runtime.getBackgroundPage(function (bg) {
        var Actions = bg.DefaultActions;
        for(var shortcutId in Actions) {
            if (Actions.hasOwnProperty(shortcutId) && shortcutId != 'defaultActions') {
                $("#" + shortcutId + " option[value=" + Actions[shortcutId] + "]").prop("selected", "selected");
            }
        }
        chrome.storage.sync.set(Actions);
    });
});

// Update settings
chrome.runtime.getBackgroundPage(function (bg) {
    var Actions = bg.DefaultActions;
    for(var shortcutId in Actions) {
        if (Actions.hasOwnProperty(shortcutId) && shortcutId != 'defaultActions') {
            (function(sId){
                $("#" + sId).change(function(){
                    var str = "";
                    $( "#" + sId + " option:selected" ).each(function() {
                        str = $(this).val();
                    });
                    var storeSeeting = {};
                    storeSeeting[sId] = str;
                    chrome.storage.sync.set(storeSeeting);
                });
            })(shortcutId);
        }
    }
});