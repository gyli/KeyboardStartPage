// Get the current tab id
chrome.tabs.getSelected(null, function(tab){
    window.MainTabId = tab.id
});

// Set default links if it's the first time
chrome.storage.sync.get(null, function(val) {
    chrome.runtime.getBackgroundPage(function (bg) {
        if (val['default'] != "passed" || typeof val['default'] === "undefined"){
            var defaultValue = bg.DefaultLink;
            chrome.storage.sync.set(defaultValue);
            // Refresh page to get new icons
            bg.RefreshTab(window.mainTabId);
        }
        // If option is empty, passing default value
        var Actions = bg.DefaultActions;
        for(var action in Actions) {
            if (Actions.hasOwnProperty(action)) {
                if (typeof val[action] === "undefined"){
                    chrome.storage.sync.set({action: Actions[action]});
                }
            }
        }
    });
});

// Set default settings if it's the first time
chrome.storage.sync.get('defaultActions', function(val) {
    chrome.runtime.getBackgroundPage(function (bg) {
        if (val['defaultActions'] != "passed" || typeof val['defaultActions'] === "undefined"){
            var defaultValue = bg.DefaultActions;
            chrome.storage.sync.set(defaultValue);
        }
    });
});

function btnHover(btn){
    $("#li_" + btn).addClass("active");
    setTimeout(function(){
        $("#li_" + btn).removeClass("active");
    }, 200);
}

var Keys = "1234567890abcdefghijklmnopqrstuvwxyz";
var BtnPrefix = "li_";
for(var i=0; i<Keys.length; i++) {
    var btnName = Keys.charAt(i);
    var BtnId = BtnPrefix + btnName;

    // register the hover action to display edit button
    $('#li_' + btnName).hover(
        function() {
            $(this).addClass('visible');
        },
        function() {
            $(this).removeClass('visible');
        }
    );

    // edit button
    var editBtn = document.getElementById(BtnId).getElementsByClassName("edit")[0];
    editBtn.addEventListener('click', function () {
        // Get the button name
        var TargetBtnId = this.parentNode.parentNode.getAttribute('id');
        // when clicking small icon, don't open the link
        event.cancelBubble=true;
        // Open the setting page
        chrome.runtime.getBackgroundPage(function(e){
            e.SettingPopup(TargetBtnId, window.MainTabId);
        });
    });

    // delete button
    var deleteBtn = document.getElementById(BtnId).getElementsByClassName("delete")[0];
    deleteBtn.addEventListener('click', function () {
        var TargetBtnId = this.parentNode.parentNode.getAttribute('id');
        // when clicking small icon, don't open the link
        event.cancelBubble=true;
        // Only delete when the value is not null
        chrome.storage.sync.get(TargetBtnId, function(val) {
            if (val[TargetBtnId] !== null && typeof val[TargetBtnId] !== "undefined"){
                // Delete the stored link
                chrome.storage.sync.remove(TargetBtnId);
                // refresh the start page
                chrome.runtime.getBackgroundPage(function(e){
                    e.RefreshTab(window.MainTabId);
                });
            }
        });
    });

    // Key clicking
    var clickBtn = document.getElementById(BtnId);
    clickBtn.addEventListener('click', function (event) {
        var TargetBtnId = this.getAttribute('id');
        chrome.runtime.getBackgroundPage(function(e) {
            if (event.which == 2 && event.shiftKey) {
                // Shift + middle click
                e.JumpToLink(TargetBtnId, 'active');
            }else if (event.metaKey && event.shiftKey){
                // Command + Shift + click or Ctrl + Shift + click
                e.JumpToLink(TargetBtnId, 'active');
            }else if (event.metaKey || event.ctrlKey){
                //Ctrl + click or Command + click
                e.JumpToLink(TargetBtnId, 'inactive');
            }else if (event.which == 2){
                // middle click
                e.JumpToLink(TargetBtnId, 'inactive');
            }else if (event.shiftKey){
                // Shift + click
                e.JumpToLink(TargetBtnId, 'window');
            }else{
                // left click
                e.JumpToLink(TargetBtnId, 'same');
            }
        });
    });

    (function(btnName) {
        // <Key>
        Mousetrap.bind(btnName, function () {
            chrome.runtime.getBackgroundPage(function(e){e.JumpToLink(BtnPrefix + btnName, 'same');});
            btnHover(btnName);
        });

        // Alt+Key+<Key>
        // TODO: test alt+F in Windows
        Mousetrap.bind('alt+'+btnName, function () {
            chrome.runtime.getBackgroundPage(function (e){e.JumpToLink(BtnPrefix + btnName, 'inactive');});
            btnHover(btnName);
        });

        // Shift+<Key>
        Mousetrap.bind('shift+'+btnName, function () {
            chrome.runtime.getBackgroundPage(function (e){e.JumpToLink(BtnPrefix + btnName, 'window');});
            btnHover(btnName);
        });

        // Shift+Alt+<Key>
        Mousetrap.bind('shift+alt+'+btnName, function () {
            chrome.runtime.getBackgroundPage(function (e){e.JumpToLink(BtnPrefix + btnName, 'active');});
            btnHover(btnName);
        });
    })(btnName);

    // Whether displaying favicon
    (function(BtnId) {
        chrome.storage.sync.get(BtnId, function(val) {
            var favicon = $("#" + BtnId + " img");
            if (val[BtnId] !== null && typeof val[BtnId] !== "undefined"){
                favicon.attr("src", "http://www.google.com/s2/favicons?domain=" + val[BtnId]);
                favicon.css("visibility", "visible");
            }
        });
    })(BtnId);
}