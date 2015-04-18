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
            eventPage.SettingPopup(TargetBtnId);
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
        // TODO: refresh the page to update the icon?
    });

    // Clicking
    var clickBtn = document.getElementById(BtnId);
    clickBtn.addEventListener('click', function () {
        var TargetBtnId = this.getAttribute('id');
        chrome.runtime.getBackgroundPage(function(eventPage) {
            eventPage.jumpToLink(TargetBtnId);
        });
    });

    // Single key binding
    (function(btnName) {
        Mousetrap.bind(btnName, function () {
            chrome.runtime.getBackgroundPage(function (eventPage) {
                eventPage.jumpToLink(BtnPrefix + btnName);
            });
            // TODO: hover the div with color
        });
    })(btnName);
}