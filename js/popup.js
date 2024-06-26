var output = document.getElementById('output');
var input = document.getElementById('newLink');
var warning = document.getElementById('warning');
var form = document.querySelector('form');

// Get the key id
window.btn = getQueryVariable("btn");
window.mainTabId = parseInt(getQueryVariable("tabid"));
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0) {
        window.popUpTabId = tabs[0].id;
    }
});

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) {
            return pair[1];
        }
    }
}

function IsURL(str_url) {
    var strRegex = "^((https|http|ftp|rtsp|mms)?://)" + "?(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?" + "(([0-9]{1,3}.){3}[0-9]{1,3}" + "|" + "([0-9a-z_!~*'()-]+.)*" + "([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]." + "[a-z]{2,6})" + "(:[0-9]{1,4})?" + "((/?)|" + "(/[0-9a-z_!~*'().;?:@&=+$,%#-]+)+/?)$";
    var re = new RegExp(strRegex);
    return !!re.test(str_url);
}

// Set up initial value of input box and put cursor at end of it
var first = true;
input.addEventListener("focus", function() {
    if (first == true){
        this.value = 'http://';
        first = false;
    }
});

// Refresh tab
function RefreshTab(tabid) {
    chrome.tabs.reload(tabid);
}

// Close tab
function CloseTab(tabid) {
    chrome.tabs.remove(tabid);
}

// Get a new link
form.addEventListener('submit', function(e) {
    // Get input link
    var newLink=input.value;
    if (IsURL(newLink)){
        // Create the link object with the same button id
        var storeLink = {};
        var storeLinkKey = window.btn;
        // Add 'http://' if it's missing
        if (!newLink.match(/^[a-zA-Z]+:\/\//)){
            newLink = 'http://' + newLink;
        }
        storeLink[storeLinkKey] = newLink;
        // Store it
        chrome.storage.sync.set(storeLink);
        // Refesh the start page
        // RefreshTab(window.mainTabId)
        // Close the popup
        CloseTab(window.popUpTabId);
    }else{
        warning.innerText = 'Please input a valid URL.';
    }
    e.preventDefault();
});

function valueChanged(KeyId, newValue) {
    if (newValue !== null && typeof newValue !== "undefined"){
        output.innerText = "Key '" + KeyId.substring(3, 4).toUpperCase() + "' is currently bound to " + newValue;
    }else{
        output.innerText = 'This key has not been bound.';
    }
}

// After the link changed
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes[window.btn]) {
        valueChanged(window.btn, changes[window.btn].newValue);
        // Refresh the parent page
        RefreshTab(window.mainTabId);
    }
});

chrome.storage.sync.get(window.btn, function(val) {valueChanged(window.btn, val[window.btn])});
