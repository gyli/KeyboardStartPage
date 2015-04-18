var output = document.getElementById('output');
var input = document.getElementById('newLink');
var form = document.querySelector('form');

// Get the button id
window.btn = getQueryVariable("btn");
window.mainTabId = parseInt(getQueryVariable("tabid"));
chrome.tabs.getSelected(null, function(tab){
    window.popUpTabId=tab.id
});

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) {
            return pair[1];
        }
    }
}

function Refesh(id) {
    chrome.runtime.getBackgroundPage(function (eventPage) {
        eventPage.RefreshTab(id);
    });
}

function Close(id) {
    chrome.runtime.getBackgroundPage(function (eventPage) {
        eventPage.RefreshTab(id);
    });
}

// Get a new link
form.addEventListener('submit', function(event) {
    // Get input link
    var newLink=input.value;
    // TODO: link validation
    // Create the link object with the same button id
    var storeLink = {};
    var storeLinkKey = window.btn;
    storeLink[storeLinkKey] = newLink;
    // Store it
    chrome.storage.sync.set(storeLink, function() {});
    // Refesh the start page
    Refesh(window.mainTabId);
    // Close the popup
    Close(window.popUpTabId);
    event.preventDefault();
});

function valueChanged(KeyId, newValue) {
    if (newValue !== null && typeof newValue !== "undefined"){
        output.innerText = "Key '" + KeyId.substring(3, 4).toUpperCase() + "' is binded to " + newValue;
        output.className = "changed";
    }
    else{
        output.innerText = 'This key has not been setted yet!';
    }
    //window.setTimeout(function() {output.className="";}, 200);
}

// After the link changed
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes[window.btn]) {
        valueChanged(window.btn, changes[window.btn].newValue);
        // Refresh the parent page
        Refesh(window.mainTabId);
    }
});

chrome.storage.sync.get(window.btn, function(val) {valueChanged(window.btn, val[window.btn])});