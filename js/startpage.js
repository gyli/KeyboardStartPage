// Get the current tab id
chrome.tabs.getSelected(null, function(tab){
    window.MainTabId=tab.id
});

String.prototype.inList=function(list){
    return ( list.indexOf(this.toString()) != -1)
}

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
        chrome.runtime.getBackgroundPage(function(eventPage) {
            eventPage.DeleteLink(TargetBtnId);
        });
        chrome.runtime.getBackgroundPage(function(eventPage) {
            eventPage.RefreshTab(window.MainTabId);
        });
        // TODO: refresh the page to update the icon?
    });

    // Clicking
    var clickBtn = document.getElementById(BtnId);
    clickBtn.addEventListener('click', function () {
        var TargetBtnId = this.getAttribute('id');
        // Add default values
        chrome.storage.sync.get(TargetBtnId, function(val) {
            if (typeof val[TargetBtnId] === "undefined" && TargetBtnId.inList(['li_y','li_c','li_g'])){
                chrome.runtime.getBackgroundPage(function(eventPage) {
                    eventPage.JumpToDefaultLink(TargetBtnId);
                });
            }else{
                chrome.runtime.getBackgroundPage(function(eventPage) {
                    eventPage.JumpToLink(TargetBtnId);
                });
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

    // Whether display favicon
    (function(BtnId) {
        var favicon = document.getElementById(BtnId).getElementsByClassName("fav")[0];

        chrome.storage.sync.get(BtnId, function(val) {
            if (val[BtnId] !== null && typeof val[BtnId] !== "undefined"){
                favicon.src = 'http://www.google.com/s2/favicons?domain=' + val[BtnId];
            }
            else{
                if (BtnId.inList(['li_y','li_c','li_g'])){
                    favicon.src = 'http://www.google.com/s2/favicons?domain=google.com';
                }else{
                    favicon.src = "//:0";
                    favicon.className += ' hide';
                }
            }
        });
    })(BtnId);



}