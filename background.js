// Open setting page
function SettingPopup(btnName, tabid) {
    // URL is too dirty
    chrome.windows.create({url : "popup.html?btn="+btnName+'&tabid='+tabid,
        type: "popup",
        height: 230,
        width: 640,
        top: 200,
        left: 200
    });
}

function JumpToLink(BtnId, type) {
    // BtnId: example li_1
    chrome.storage.sync.get(BtnId, function(val) {
        if (val[BtnId] !== null && typeof val[BtnId] !== "undefined"){
            if (type == 'same') {  // Open link in the same tab
                chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                    var tab = tabs[0];
                    chrome.tabs.update(tab.id, {url: val[BtnId]});
                });
            }else if (type == 'active'){  // Open link in a new tab
                window.open(val[BtnId]);
            }else if (type == 'inactive'){  // Open link in a new tab but inactive
                chrome.tabs.create({url : val[BtnId], active:false});
            }else if(type == 'window'){  // Open link in a new window
                chrome.windows.create({url : val[BtnId]});
            }else{
                console.log('Invalid tab parameter.');
            }
        }
    });
}

// Refresh tab
function RefreshTab(tabid) {
    chrome.tabs.reload(tabid);
}

// Close tab
function CloseTab(tabid) {
    chrome.tabs.remove(tabid);
}

var DefaultLink = {
    'default': 'passed',
    'li_t': 'https://twitter.com/',
    'li_g': 'https://www.google.com/',
    'li_y': 'http://www.youtube.com',
    'li_f': 'https://www.facebook.com/'};

var DefaultActions = {
    'defaultActions': 'passed',
    'ShiftMiddleClick': 'active',
    'CtrlShiftClick': 'active',
    'CtrlClick': 'inactive',
    'MiddleClick': 'inactive',
    'ShiftClick': 'window',
    'Click': 'same',
    'Key': 'same',
    'AltKey': 'inactive',
    'ShiftKey': 'window',
    'ShiftAltKey': 'active'
};

var ShortcutOptions = {
    'active': 'In a new tab and switch to it',
    'inactive': 'In a new tab but in the background',
    'same': 'In the same tab',
    'window': 'In a new window',
    'none': 'None'
};