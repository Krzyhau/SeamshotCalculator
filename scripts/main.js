var SeamshotWorker = null;
var bspFile = null;

function log(msg) {
    document.querySelector("#log").innerHTML = msg;
}


function requestBSPFile() {
    if (bspFile == null) {
        bspFile = document.createElement('input');
        bspFile.setAttribute('type', 'file');
        bspFile.setAttribute('accept', ".bsp");
        bspFile.style.display = 'none';
        document.body.appendChild(bspFile);

        bspFile.onchange = () => {
            let name = "Choose a BSP map file."
            if(bspFile.files && bspFile.files[0]){
                name = bspFile.files[0].name;
            }
            document.querySelector("#bspFileInput").value = name;
        }
    }
    bspFile.click();
}


function loadFile() {
    if (typeof window.FileReader !== 'function') {
        log("Error: FileReader API isn't supported on this browser.");
        return;
    }

    if (!window.Worker) {
        log("Error: Web Worker isn't supported in this browser.");
        return;
    }

    if (SeamshotWorker != null) {
        log("Error: Web Worker is processing something already.");
        return;
    }

    if(!bspFile || !bspFile.files || !bspFile.files[0]){
        log("Error: File could not be loaded.");
        return;
    }

    document.querySelector("#bspFileInput").disabled = true;
    document.querySelector("#bspFileLoad").disabled = true;
    
    let file = bspFile.files[0];
    let fr = new FileReader();
    fr.onload = function () {

        SeamshotWorker = new Worker('scripts/seamshot-finder.js');
        
        SeamshotWorker.onmessage = function (e) {
            if (typeof (e.data) == "string") {
                log(e.data);
            } else {
                let filename = file.name.split(".")[0] + "_seams.cfg";
                outputSeamshotsIntoFile(e.data, filename);
                SeamshotWorker = null;
                document.querySelector("#bspFileInput").disabled = false;
                document.querySelector("#bspFileLoad").disabled = false;
            }
        }

        SeamshotWorker.postMessage(fr.result);
    };
    fr.readAsArrayBuffer(file);
}



// converts seamshot array into a drawline commands string, then requests download.
function outputSeamshotsIntoFile(seamshots, filename) {
    let output = "";

    for (let seamshot of seamshots) {
        output +=
            "sar_drawline "
            + seamshot.point1.x + " " + seamshot.point1.y + " " + seamshot.point1.z + " "
            + seamshot.point2.x + " " + seamshot.point2.y + " " + seamshot.point2.z + " "
            + (seamshot.planenum > 1 ? "0 255 0" : (seamshot.type == 0 ? "255 150 0" : "255 0 0"))
            + "\n";
    }

    download(filename, output);
}


// download text in a file.
function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
