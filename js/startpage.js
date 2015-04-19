// Get the current tab id
chrome.tabs.getSelected(null, function(tab){
    window.MainTabId=tab.id
});

// Set default values
chrome.storage.sync.get('default', function(val) {
    if (val['default'] != "passed" || typeof val['default'] === "undefined"){
        var defaultlink = {
            'li_c': 'http://www.crowdskout.com/',
            'li_g': 'https://www.google.com/',
            'li_y': 'http://youtube.com/',
            'li_k': 'http://keep.google.com/',
            'li_s': 'http://stackoverflow.com/',
            'default': 'passed'
        };
        chrome.storage.sync.set(defaultlink, function(){});
        // Refesh page to get new icons
        chrome.runtime.getBackgroundPage(function (eventPage) {
            eventPage.RefreshTab(window.mainTabId);
        });
    }
});

var Keys = "1234567890abcdefghijklmnopqrstuvwxyz";
var BtnPrefix = "li_";
for(var i=0; i<Keys.length; i++) {
    var btnName = Keys.charAt(i);
    var BtnId = BtnPrefix + btnName;

    // edit button
    var editBtn = document.getElementById(BtnId).getElementsByClassName("edit")[0];
    editBtn.addEventListener('click', function () {
        // Get the button name
        var TargetBtnId = this.parentNode.parentNode.getAttribute('id');
        // when clicking small icon, don't open the link
        event.cancelBubble=true;
        // Open the setting page
        chrome.runtime.getBackgroundPage(function(eventPage) {
            eventPage.SettingPopup(TargetBtnId, window.MainTabId);
        });
    });

    // delete button
    var deleteBtn = document.getElementById(BtnId).getElementsByClassName("delete")[0];
    deleteBtn.addEventListener('click', function () {
        var TargetBtnId = this.parentNode.parentNode.getAttribute('id');
        // when clicking small icon, don't open the link
        event.cancelBubble=true;
        // Delete the stored link
        chrome.storage.sync.remove(TargetBtnId);
        // refresh the start page
        chrome.runtime.getBackgroundPage(function(eventPage) {
            eventPage.RefreshTab(window.MainTabId);
        });
    });

    // Key clicking
    var clickBtn = document.getElementById(BtnId);
    clickBtn.addEventListener('click', function (e) {
        var TargetBtnId = this.getAttribute('id');
        chrome.runtime.getBackgroundPage(function(eventPage) {
            if (e.which == 2) {  // middle click
                eventPage.JumpToLinkInNewTab(TargetBtnId);
            }else{  // left click
                eventPage.JumpToLink(TargetBtnId);
            }
        });
    });

    // Single key binding
    (function(btnName) {
        Mousetrap.bind(btnName, function () {
            chrome.runtime.getBackgroundPage(function (eventPage) {
                eventPage.JumpToLink(BtnPrefix + btnName);
            });
            // TODO: hover the div with color
        });
    })(btnName);

    // Combined key binding
    (function(btnName) {
        Mousetrap.bind('shift+'+btnName, function () {
            chrome.runtime.getBackgroundPage(function (eventPage) {
                eventPage.JumpToLinkInNewTab(BtnPrefix + btnName);
            });
            // TODO: hover the div with color
        });
    })(btnName);

    // Whether display favicon
    (function(BtnId) {
        var favicon = document.getElementById(BtnId).getElementsByClassName("fav")[0];
        chrome.storage.sync.get(BtnId, function(val) {
            if (val[BtnId] !== null && typeof val[BtnId] !== "undefined"){
                favicon.src = 'http://www.google.com/s2/favicons?domain=' + val[BtnId];
            }else{
                favicon.src = "//:0";
                favicon.className = 'fav hide';
            }
        });
    })(BtnId);



}