document.addEventListener('DOMContentLoaded', function () {
    chrome.runtime.getBackgroundPage(function (bg) {
        chrome.storage.sync.get(null, function (val) {
            var Actions = bg.DefaultActions;
            var ShortcutOption = bg.ShortcutOptions;
            for (var shortcutId in Actions) {
                if (Actions.hasOwnProperty(shortcutId) && shortcutId != 'defaultActions') {
                    $.each(ShortcutOption, function (key, value) {
                        $("#" + shortcutId).append($("<option></option>").attr("value", key).text(ShortcutOption[key]));
                    });
                    $("#" + shortcutId + " option[value=" + val[shortcutId] + "]").prop("selected", "selected");
                }
            }
        });
    });
});

chrome.runtime.getBackgroundPage(function (bg) {
    // Set to default actions
    $("#shortcut-default").click(function () {
        var Actions = bg.DefaultActions;
        for(var shortcutId in Actions) {
            if (Actions.hasOwnProperty(shortcutId) && shortcutId != 'defaultActions') {
                $("#" + shortcutId + " option[value=" + Actions[shortcutId] + "]").prop("selected", "selected");
            }
        }
        chrome.storage.sync.set(Actions);
    });

    // Update settings
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

    // Background color
    var defaultcolor = bg.DefaultBGColor;
    chrome.storage.sync.get('bgColor', function(val){
        var initialColor = defaultcolor;
        if (val['bgColor'] !== null && typeof val['bgColor'] !== "undefined"){
            initialColor = val['bgColor']
        }
        // Display current setting
        document.querySelector('input[type="color"]').value = initialColor;
    });
    // Update setting when changing
    $('#colorpicker').on("change",function(){
        chrome.storage.sync.set({bgColor: $("#colorpicker").val()});
    });
    // Set to default color
    $("#bgcolor-default").click(function () {
        $('#colorpicker').val(defaultcolor);
        chrome.storage.sync.set({bgColor: defaultcolor});
    });
});