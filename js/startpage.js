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

const DefaultBGColor = '#EEEEEE';

var DefaultLink = {
    'default': 'passed',
    'li_t': 'https://twitter.com/',
    'li_g': 'https://www.google.com/',
    'li_y': 'http://www.youtube.com',
    'li_f': 'https://www.facebook.com/'};


function btnHover(btn){
    $("#li_" + btn).addClass("active");
    setTimeout(function(){
        $("#li_" + btn).removeClass("active");
    }, 200);
}

// Get the current tab id
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0) {
        window.MainTabId = tabs[0].id;
    }
});

document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.sync.get(['bgColor', 'default', 'defaultActions'], function (val) {
        // Update background color
        const defaultColor = DefaultBGColor;
        let initialColor = defaultColor;
        if (val['bgColor'] !== null && typeof val['bgColor'] !== "undefined") {
            initialColor = val['bgColor'];
        } else {
            chrome.storage.sync.set({bgColor: defaultColor});
        }
        $('html').css('background', initialColor);

        // Set default links and settings if it's the first time
        if (val['default'] !== "passed" || typeof val['default'] === "undefined") {
            const defaultValue = DefaultLink;
            chrome.storage.sync.set(defaultValue);
            // Refresh page to get new icons
            RefreshTab(window.mainTabId);
        }
        // If option is empty, passing default value
        if (val['defaultActions'] !== "passed" || typeof val['defaultActions'] === "undefined") {
            chrome.storage.sync.set(DefaultActions);
        }
    });
});

const Keys = "1234567890abcdefghijklmnopqrstuvwxyz";
const BtnPrefix = "li_";

function SettingPopup(btnName, tabid) {
    // URL is too dirty
    chrome.windows.create({
        url: "popup.html?btn=" + btnName + '&tabid=' + tabid,
        type: "popup",
        height: 230,
        width: 640,
        top: 200,
        left: 200
    });
}

// Jump to link
function JumpToLink(BtnId, type) {
    chrome.storage.sync.get(BtnId, function(val) {
        if (val[BtnId] !== null && typeof val[BtnId] !== "undefined") {
            if (type == 'same') {  // Open link in the same tab
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    var tab = tabs[0];
                    chrome.tabs.update(tab.id, {url: val[BtnId]});
                });
            } else if (type == 'active') {  // Open link in a new tab
                window.open(val[BtnId]);
            } else if (type == 'inactive') {  // Open link in a new tab but inactive
                chrome.tabs.create({url: val[BtnId], active: false});
            } else if (type == 'window') {  // Open link in a new window
                chrome.windows.create({url: val[BtnId]});
            } else {
                console.log('Invalid tab parameter.');
            }
        }
    });
}

// Refresh tab
function RefreshTab(tabid) {
    chrome.tabs.reload(tabid);
}

chrome.storage.sync.get(null, function (val) {
    for (let i = 0; i < Keys.length; i++) {
        const btnName = Keys.charAt(i);
        const BtnId = BtnPrefix + btnName;

        // register the hover action to display edit button
        $('#li_' + btnName).hover(
            function () {
                $(this).addClass('visible');
            },
            function () {
                $(this).removeClass('visible');
            }
        );

        // edit button
        const editBtn = document.getElementById(BtnId).getElementsByClassName("edit")[0];
        editBtn.addEventListener('click', function (event) {
            // Get the button name
            const TargetBtnId = this.parentNode.parentNode.getAttribute('id');
            // when clicking small icon, don't open the link
            event.cancelBubble = true;
            // Open the setting page
            SettingPopup(TargetBtnId, window.MainTabId);
        });

        // delete button
        const deleteBtn = document.getElementById(BtnId).getElementsByClassName("delete")[0];
        deleteBtn.addEventListener('click', function (event) {
            const TargetBtnId = this.parentNode.parentNode.getAttribute('id');
            // when clicking small icon, don't open the link
            event.cancelBubble = true;
            // Only delete when the value is not null
            if (val[TargetBtnId] !== null && typeof val[TargetBtnId] !== "undefined") {
                // Delete the stored link
                chrome.storage.sync.remove(TargetBtnId);
                // delete the icon
                const favicon = $("#" + TargetBtnId + " img");
                favicon.attr("src", "#");
                favicon.css("visibility", "hidden");
            }
        });

        // Key clicking
        const clickBtn = document.getElementById(BtnId);
        clickBtn.addEventListener('click', function (event) {
            const TargetBtnId = this.getAttribute('id');
            const clickType = event.which == 2 && event.shiftKey ? 'ShiftMiddleClick'
                : event.metaKey && event.shiftKey ? 'CtrlShiftClick'
                : event.metaKey || event.ctrlKey ? 'CtrlClick'
                : event.which == 2 ? 'MiddleClick'
                : event.shiftKey ? 'ShiftClick'
                : 'Click';
            JumpToLink(TargetBtnId, val[clickType]);
        });

        (function (btnName) {
            // <Key>
            Mousetrap.bind(btnName, function () {
                JumpToLink(BtnPrefix + btnName, val['Key']);
                btnHover(btnName);
            });

            // Shift + <Key>
            Mousetrap.bind('shift+' + btnName, function () {
                JumpToLink(BtnPrefix + btnName, val['ShiftKey']);
                btnHover(btnName);
            });
        })(btnName);

        // Whether displaying favicon
        (function (BtnId) {
            const favicon = $("#" + BtnId + " img");
            if (val[BtnId] !== null && typeof val[BtnId] !== "undefined") {
                favicon.attr("src", "http://www.google.com/s2/favicons?domain=" + val[BtnId]);
                favicon.css("visibility", "visible");
            }
        })(BtnId);
    }
});
