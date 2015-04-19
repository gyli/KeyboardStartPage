// Get the current tab id
chrome.tabs.getSelected(null, function(tab){
    window.MainTabId = tab.id
});

// Set default values if it's the first time
chrome.storage.sync.get('default', function(val) {
    if (val['default'] != "passed" || typeof val['default'] === "undefined"){
        var defaultlink = {
            'li_t': 'https://twitter.com/',
            'li_g': 'https://www.google.com/',
            'li_y': 'http://youtube.com/',
            'li_f': 'https://www.facebook.com/',
            'default': 'passed'
        };
        chrome.storage.sync.set(defaultlink, function(){});
        // Refesh page to get new icons
        chrome.runtime.getBackgroundPage(function(e){
            e.RefreshTab(window.mainTabId);
        });
    }
});

var Keys = "1234567890abcdefghijklmnopqrstuvwxyz";
var BtnPrefix = "li_";
for(var i=0; i<Keys.length; i++) {
    var btnName = Keys.charAt(i);
    var BtnId = BtnPrefix + btnName;

    // register the hover action
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
            if (event.which == 2) {  // middle click
                e.JumpToLinkInNewTab(TargetBtnId);
            }else{  // left click
                e.JumpToLink(TargetBtnId);
            }
        });
    });

    (function(btnName) {
        // Single key binding
        Mousetrap.bind(btnName, function () {
            chrome.runtime.getBackgroundPage(function(e){e.JumpToLink(BtnPrefix + btnName);});
            $("#li_" + btnName).addClass("active");
            setTimeout(function(){
                $("#li_" + btnName).removeClass("active");
            }, 200);
        });

        // Combined key binding: open link in new tab by pressing Shift+Key
        Mousetrap.bind('shift+'+btnName, function () {
            chrome.runtime.getBackgroundPage(function (e){e.JumpToLinkInNewTab(BtnPrefix + btnName);});
            $("#li_" + btnName).addClass("active");
            setTimeout(function(){
                $("#li_" + btnName).removeClass("active");
            }, 200);
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