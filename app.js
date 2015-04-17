(function(){
    var btn = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for(var i=0; i<btn.length; i++) {
        var btnName = btn.charAt(i);
        var btnId = "LI_" + btnName;
        var editBtn = document.getElementById(btnId).getElementsByClassName("a1 edit")[0];
        editBtn.addEventListener('click', function (event) {
            // Prepare the button name
            var BtnId = this.parentNode.parentNode.parentNode.getAttribute('id');

            // Open the setting page
            chrome.runtime.getBackgroundPage(function(eventPage) {
                eventPage.SettingPopup(BtnId);
            });
        });

        var deleteBtn = document.getElementById(btnId).getElementsByClassName("a1 delete")[0];
        deleteBtn.addEventListener('click', function () {
            chrome.runtime.getBackgroundPage(function(eventPage) {

            });
        });

        var clickBtn = document.getElementById(btnId);
        clickBtn.addEventListener('click', function () {
            chrome.runtime.getBackgroundPage(function(eventPage) {
                eventPage.jumpToLink(BtnId);
            });
        });
    }
})();