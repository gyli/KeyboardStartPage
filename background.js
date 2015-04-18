// Open setting page
function SettingPopup(btnName) {
    chrome.windows.create({url : "popup.html?btn="+btnName, type: "popup", height: 300, width: 500, top: 300, left: 300});
}

// Open link
function jumpToLink(BtnId) {
    chrome.storage.sync.get(BtnId, function(val) {
        if (val[BtnId] !== null && typeof val[BtnId] !== "undefined"){
            // Open link with a new tab
            //window.open(val[BtnId]);
            // Open link in the same tab
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                var tab = tabs[0];
                chrome.tabs.update(tab.id, {url: val[BtnId]});
            });
        }else{
        //TODO: blink the button with another color
        }
    });
}

// Delete link
function DeleteLink(BtnId) {
    chrome.storage.sync.remove(BtnId);
}