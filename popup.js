var output = document.getElementById('output');
var input = document.getElementById('myValue');
var form = document.querySelector('form');
var logarea = document.querySelector('textarea');

// Get the button id
window.btn = getQueryVariable("btn");

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

// Get a new link
// TODO: close current page and maybe refresh the main page?
form.addEventListener('submit', function(event) {
    // Get input link
    var newLink=input.value;
    // TODO: link validation
    // Create the link object with the same button id
    var storeLink = {};
    var storeLinkKey = window.btn;
    storeLink[storeLinkKey] = newLink;
    // Store it
    chrome.storage.sync.set(storeLink, function() {
        // for debug
        log("setting "+storeLinkKey+" to "+newLink);
    });
    event.preventDefault();
});

// below codes are only for debugging

function log(str) {
    logarea.value=str+"\n"+logarea.value;
}

function valueChanged(newValue) {
    output.innerText = newValue;
    output.className="changed";
    // TODO: what if there is no initial value? undefined?
    window.setTimeout(function() {output.className="";}, 200);
    log("value myValue changed to "+newValue);
}

// For debugging purposes:
function debugChanges(changes, namespace) {
    for (key in changes) {
        console.log('Storage change: key='+key+' value='+JSON.stringify(changes[key]));
    }
}

// After the link changed
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes[window.btn]) {
        valueChanged(changes[window.btn].newValue);
    }
    debugChanges(changes, namespace);
});

chrome.storage.sync.get(window.btn, function(val) {valueChanged(val[window.btn])});