// Open setting page
function SettingPopup(btnName) {
    chrome.windows.create({url : "popup.html?btn="+btnName, type: "popup", height: 300, width: 500, top: 300, left: 300});
}

// Open link
function jumpToLink(btnName) {
    chrome.storage.sync.get(window.btn, function(val) {
        valueChanged(val[window.btn])
        window.open()
    });
    chrome.windows.create({url : "popup.html?btn="+btnName,type: "popup", height: 600, width:600});
}